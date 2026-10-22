/*
╔══════════════════════════════════════════════════════════════════════╗
║                              row                              ║
║                     © row — All Rights Reserved              ║
╚══════════════════════════════════════════════════════════════════════╝
*/
const { SlashCommandBuilder } = require('discord.js');
const fetch = require('node-fetch');
const { getHeaders } = require('../utils/headers');
const { EMOJIES } = require('../utils/emojis');
const { config } = require('../utils/config');
const {
    getAutoQuestUsers,
    getFirstToken,
    getTokenRow,
    setAutoQuest,
    scheduleAutoQuest,
    getDueAutoQuests,
    deleteScheduledQuest,
    getSetting,
    setTokenValid,
    getLanguage,
    backupDatabase,
} = require('../database/db');
const { autoSolveQuest, detectTaskName } = require('../handler/handler');
const { buildQuestEmbed, extractQuestInfo } = require('../utils/questCard');
const { t } = require('../utils/i18n');
const { isVip } = require('../utils/permissions');
const {
    fetchRegionMap,
    fetchPublicQuests,
    isQuestActive,
    getQuestRegionInfo,
    formatRegions,
} = require('../utils/regions');

const knownQuests = new Set();
let notifierClient = null;

/** Publish new quest to quest-room channel (global + region-locked) */
async function postNewQuestToLogChannel(quest, { regional = false } = {}) {
    if (!notifierClient) return;

    const channelId = getSetting('QUEST_ROOM_CHANNEL_ID') || config.QUEST_ROOM_CHANNEL_ID || config.LOG_CHANNEL_ID;
    if (!channelId) return;

    try {
        let channel = notifierClient.channels.cache.get(channelId);
        if (!channel) {
            channel = await notifierClient.channels.fetch(channelId).catch(() => null);
        }
        if (!channel) return;

        // Ensure region cache is warm so embed shows Regions
        await fetchRegionMap();
        const payload = buildQuestEmbed(quest, { isNew: true });

        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const info = extractQuestInfo(quest);
        const isRegional = regional || (info.regions && !info.regions.isGlobal);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('View Quest')
                .setStyle(ButtonStyle.Link)
                .setURL(`https://discord.com/quests/${info.id}`)
                .setEmoji('🔗'),
            new ButtonBuilder()
                .setLabel('Do with Bot')
                .setStyle(ButtonStyle.Primary)
                .setCustomId(`questroom_do_${info.id}`)
                .setEmoji('🤖'),
        );
        payload.components = [row];

        if (isRegional && info.regions && info.regions.text) {
            payload.content = `🌐 **Region-locked quest** — VPN: ${info.regions.lines.join(' · ')}`;
        }

        await channel.send(payload);
    } catch (err) {
        console.error(`[Notifier] Failed to post quest: ${err.message}`);
    }
}

let publicSeeded = false;

/**
 * Scan public quest + region APIs so region-only quests still post to quest-room
 * even if the bot token is not in that country.
 * First run only seeds knownQuests (no spam). Later runs post truly new ones.
 */
async function checkPublicRegionQuests() {
    if (!notifierClient) return;
    try {
        const [regionData, publicQuests] = await Promise.all([
            fetchRegionMap(),
            fetchPublicQuests(),
        ]);
        if (!publicQuests.length) return;

        // First pass: seed IDs only so we don't dump the entire catalog into the room
        if (!publicSeeded) {
            for (const q of publicQuests) {
                const qId = String(q.id || (q.config && q.config.id) || '');
                if (qId) knownQuests.add(qId);
            }
            publicSeeded = true;
            console.log(`[Notifier] Seeded ${knownQuests.size} public quest IDs (no post).`);
            return;
        }

        for (const q of publicQuests) {
            const qId = String(q.id || (q.config && q.config.id) || '');
            if (!qId || qId === '1412491570820812933') continue;
            if (!isQuestActive(q)) continue;
            if (knownQuests.has(qId)) continue;

            const regionInfo = getQuestRegionInfo(qId) || regionData.byId.get(qId);
            const isRegional = regionInfo && !regionInfo.isGlobal && (
                (regionInfo.include && regionInfo.include.length) ||
                (regionInfo.exclude && regionInfo.exclude.length)
            );
            knownQuests.add(qId);
            await postNewQuestToLogChannel(q, { regional: !!isRegional });
            console.log(`[Notifier] Posted public quest ${qId}${isRegional ? ' (region)' : ''}`);
        }
    } catch (err) {
        console.error(`[Notifier] checkPublicRegionQuests: ${err.message}`);
    }
}

async function sendVipDmNotification(user, quest, lang) {
    try {
        const info = extractQuestInfo(quest);
        const expires = info.expiresAt
            ? `<t:${Math.floor(new Date(info.expiresAt).getTime() / 1000)}:R>`
            : '—';
        await user.send({
            content: t(lang, 'new_quest_dm', {
                name: info.questName,
                game: info.gameName,
                expires,
            }),
        });
    } catch (err) {
        console.error(`[Notifier] DM failed for ${user.id}: ${err.message}`);
    }
}

async function initKnownQuests() {
    const row = getFirstToken();
    if (!row) return;
    const headers = getHeaders(row.token);
    try {
        const resp = await fetch('https://discord.com/api/v9/quests/@me', { headers });
        if (resp.status === 200) {
            const data = await resp.json();
            for (const q of (data.quests || [])) {
                if (q.id) knownQuests.add(q.id);
            }
            console.log(`[Notifier] Initialized ${knownQuests.size} known quests.`);
        } else if (resp.status === 401) {
            console.warn('[Notifier] First token invalid on init.');
        }
    } catch (err) {
        console.error(`[Notifier] Init error: ${err.message}`);
    }
}

async function checkNewQuests() {
    if (!notifierClient) return;

    const users = getAutoQuestUsers();
    let token = null;

    if (users.length) {
        token = users[0].token;
    } else {
        const first = getFirstToken();
        if (!first || !first.token) return;
        token = first.token;
    }

    try {
        const headers = getHeaders(token);
        const resp = await fetch('https://discord.com/api/v9/quests/@me', { headers });
        if (resp.status === 401) {
            // mark if we know which user
            if (users.length) setTokenValid(users[0].user_id, false);
            return;
        }
        if (resp.status !== 200) return;

        const data = await resp.json();
        const allQuests = data.quests || [];
        const newQuests = [];

        for (const q of allQuests) {
            const qId = q.id;
            if (qId === '1412491570820812933') continue;
            const cfg = q.config || {};
            const expiresAt = cfg.expires_at || cfg.expiresAt;
            if (expiresAt) {
                try { if (new Date() > new Date(expiresAt)) continue; } catch {}
            }
            const userStatus = q.user_status;
            if (userStatus) {
                const completed = userStatus.completed_at || userStatus.completedAt;
                if (completed) continue;
            }
            if (!knownQuests.has(qId)) {
                newQuests.push(q);
                knownQuests.add(qId);
            }
        }

        if (!newQuests.length) return;

        // Post to quest-room
        for (const q of newQuests) {
            await postNewQuestToLogChannel(q);
        }

        // Notify all VIP auto users + schedule
        for (const u of users) {
            let user = notifierClient.users.cache.get(u.user_id);
            if (!user) {
                try { user = await notifierClient.users.fetch(u.user_id); } catch {}
            }
            if (!user) continue;

            const lang = u.language || getLanguage(u.user_id) || 'en';
            for (const q of newQuests) {
                await sendVipDmNotification(user, q, lang);
                const info = extractQuestInfo(q);
                const executeAt = (Date.now() / 1000) + 30; // 30s delay for VIP
                scheduleAutoQuest(u.user_id, u.token, q.id, info.questName, q.config || {}, executeAt);
                console.log(`[Notifier] Scheduled auto quest ${q.id} for VIP user ${u.user_id}`);
            }
        }
    } catch (err) {
        console.error(`[Notifier] checkNewQuests error: ${err.message}`);
    }
}

async function checkScheduledAutoQuests() {
    if (!notifierClient) return;
    const now = Date.now() / 1000;
    const dueRows = getDueAutoQuests(now);

    for (const row of dueRows) {
        const { id, user_id, token, q_id, q_name, quest_config: questConfigStr } = row;
        deleteScheduledQuest(id);

        let user = notifierClient.users.cache.get(user_id);
        if (!user) {
            try { user = await notifierClient.users.fetch(user_id); } catch {}
        }
        if (!user) continue;

        let questConfig = {};
        try { questConfig = JSON.parse(questConfigStr); } catch {}

        try {
            await autoSolveQuest({
                user,
                token,
                qId: q_id,
                qName: q_name,
                questConfig,
                speedMode: 'fast',
            });
        } catch (err) {
            console.error(`[Notifier] autoSolve failed for ${user_id}: ${err.message}`);
        }
    }
}

function startNotifierLoops(client) {
    notifierClient = client;
    initKnownQuests().catch(() => {});
    fetchRegionMap().catch(() => {});

    // Token-based new quests every 2 minutes
    setInterval(() => {
        checkNewQuests().catch(err => console.error('[Notifier] interval error:', err.message));
    }, 2 * 60 * 1000);

    // Public + region quests every 3 minutes (posts region-locked to quest-room)
    setTimeout(() => {
        checkPublicRegionQuests().catch(err => console.error('[Notifier] public regions:', err.message));
    }, 15000);
    setInterval(() => {
        checkPublicRegionQuests().catch(err => console.error('[Notifier] public regions:', err.message));
    }, 3 * 60 * 1000);

    // Scheduled auto every 20 seconds
    setInterval(() => {
        checkScheduledAutoQuests().catch(err => console.error('[Notifier] schedule error:', err.message));
    }, 20 * 1000);

    // DB backup every 6 hours (+ once on start)
    try { backupDatabase(); } catch { }
    setInterval(() => {
        try { backupDatabase(); } catch (err) {
            console.error('[Notifier] backup error:', err.message);
        }
    }, 6 * 60 * 60 * 1000);

    console.log('[Notifier] Loops started (quests + regions + schedule + backup).');
}

module.exports = {
    data: [], // no slash commands here anymore
    startNotifierLoops,
    postNewQuestToLogChannel,
};
