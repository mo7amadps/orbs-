/*
╔══════════════════════════════════════════════════════════════════════╗
║                                                                      ║
║                  KSHK STORE  /  discord.gg/kshk                     ║
║                                                                      ║
║                     © KSHK Store — All Rights Reserved              ║
║                                                                      ║
║              This project is protected by KSHK Store.               ║
║              Do not remove or modify this copyright notice.         ║
║                                                                      ║
╚══════════════════════════════════════════════════════════════════════╝
*/
// commands/notifier.js - Equivalent to cogs/notifier.py

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
} = require('../database/db');
const { autoSolveQuest, detectTaskName } = require('../handler/handler');

const knownQuests = new Set();
let notifierClient = null;

// ─── Build Components v2 notification message ─────────────────────────────────
function buildAutoNotifyComponents(questName, taskName, expiryText) {
    return {
        flags: 1 << 15, // IS_COMPONENTS_V2
        components: [
            {
                type: 17, // Container
                components: [
                    {
                        type: 10, // Text Display
                        content: `### ${EMOJIES.quest} New quest detected`,
                    },
                    {
                        type: 14, // Separator
                        divider: true,
                        spacing: 1,
                    },
                    {
                        type: 10,
                        content: [
                            `**Quest:** ${questName}`,
                            `**Task:** ${taskName.replace(/_/g, ' ')}`,
                            `**Expires:** ${expiryText}`,
                        ].join('\n'),
                    },
                    {
                        type: 14,
                        divider: true,
                        spacing: 1,
                    },
                    {
                        type: 10,
                        content: [
                            `${EMOJIES.success} Auto mode is **ON**.`,
                            'This quest is queued and will start automatically after **10 minutes**.',
                        ].join('\n'),
                    },
                ],
            },
        ],
    };
}

// ─── Build Components v2 auto-complete message ────────────────────────────────
function buildAutoCompleteComponents(questName) {
    return {
        flags: 1 << 15,
        components: [
            {
                type: 17,
                components: [
                    {
                        type: 10,
                        content: `### ${EMOJIES.success} Auto-Quest Complete`,
                    },
                    {
                        type: 14,
                        divider: true,
                        spacing: 1,
                    },
                    {
                        type: 10,
                        content: `**${questName}** has been completed automatically.`,
                    },
                ],
            },
        ],
    };
}

// ─── Initialize known quests at startup ──────────────────────────────────────
async function initKnownQuests() {
    const row = getFirstToken();
    if (!row) return;


/* ╔══════════════════════════════════════════════════════════════════╗
 * ║                 KSHK STORE / discord.gg/kshk                    ║
 * ║                       © KSHK Store                               ║
 * ╚══════════════════════════════════════════════════════════════════╝ */
    const headers = getHeaders(row.token);
    try {
        const resp = await fetch('https://discord.com/api/v9/quests/@me', { headers });
        if (resp.status === 200) {
            const data = await resp.json();

/* ╔══════════════════════════════════════════════════════════════════╗
 * ║                 KSHK STORE / discord.gg/kshk                    ║
 * ║                       © KSHK Store                               ║
 * ╚══════════════════════════════════════════════════════════════════╝ */
            const quests = data.quests || [];
            for (const q of quests) {
                if (q.id) knownQuests.add(q.id);
            }
            console.log(`[Notifier] Initialized ${knownQuests.size} known quests.`);
        }
    } catch (err) {
        console.error(`[Notifier] Error initializing known quests: ${err.message}`);
    }
}

// ─── Check for new quests (runs every 30 minutes) ────────────────────────────
async function checkNewQuests() {
    if (!notifierClient) return;

    const users = getAutoQuestUsers();
    if (!users.length) return;

    for (const userRow of users) {
        const { user_id, token } = userRow;
        try {
            const headers = getHeaders(token);
            const resp = await fetch('https://discord.com/api/v9/quests/@me', { headers });
            if (resp.status !== 200) continue;

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

/* ╔══════════════════════════════════════════════════════════════════╗
 * ║                 KSHK STORE / discord.gg/kshk                    ║
 * ║                       © KSHK Store                               ║
 * ╚══════════════════════════════════════════════════════════════════╝ */
                if (userStatus) {
                    const completed = userStatus.completed_at || userStatus.completedAt;
                    if (completed) continue;
                }

                if (!knownQuests.has(qId)) {
                    newQuests.push(q);
                    knownQuests.add(qId);
                }
            }

            if (newQuests.length) {
                let user = notifierClient.users.cache.get(user_id);
                if (!user) {
                    try { user = await notifierClient.users.fetch(user_id); } catch {}
                }

                if (user) {
                    for (const q of newQuests) {
                        await notifyAutoQuestStarted(user, q);
                        const executeAt = (Date.now() / 1000) + 600; // 10 minutes
                        const cfg = q.config || {};
                        const messages = cfg.messages || {};
                        const qName = messages.quest_name || messages.questName || 'Unknown Quest';
                        scheduleAutoQuest(user_id, token, q.id, qName, cfg, executeAt);
                        console.log(`[Notifier] Scheduled auto quest ${q.id} for user ${user_id}`);
                    }
                }
            }

            break; // Only process first auto user for quest detection
        } catch (err) {
            console.error(`[Notifier] Error checking quests for user ${user_id}: ${err.message}`);
        }
    }
}

// ─── Check scheduled auto quests (runs every 1 minute) ───────────────────────
async function checkScheduledAutoQuests() {
    if (!notifierClient) return;

    const now = Date.now() / 1000;
    const dueRows = getDueAutoQuests(now);

    for (const row of dueRows) {
        const { id, user_id, token, q_id, q_name, quest_config: questConfigStr } = row;
        try {
            let user = notifierClient.users.cache.get(user_id);
            if (!user) {
                try { user = await notifierClient.users.fetch(user_id); } catch {}
            }

            const questConfig = JSON.parse(questConfigStr);

            // Verify quest is still available
            const headers = getHeaders(token);
            const resp = await fetch('https://discord.com/api/v9/quests/@me', { headers });

            if (resp.status === 200) {
                const data = await resp.json();
                const allQuests = data.quests || [];
                const currentQuest = allQuests.find(q => q.id === q_id);

                if (currentQuest) {
                    const userStatus = currentQuest.user_status;
                    const alreadyDone = userStatus && (userStatus.completed_at || userStatus.completedAt);
                    if (!alreadyDone) {
                        const result = await autoSolveQuest({ user, token, qId: q_id, qName: q_name, questConfig });
                        if (result && user) {
                            try {
                                const dmChannel = await user.createDM();
                                await dmChannel.send(buildAutoCompleteComponents(q_name));
                            } catch {}
                        }
                    } else {
                        console.log(`[Notifier] Scheduled auto quest ${q_id} already completed`);
                    }
                } else {
                    console.log(`[Notifier] Scheduled auto quest ${q_id} no longer available`);
                }
            } else {
                console.log(`[Notifier] Failed to check quests for scheduled auto: ${resp.status}`);
            }
        } catch (err) {
            console.error(`[Notifier] Error executing scheduled auto quest: ${err.message}`);
        }

        // Remove from database regardless
        deleteScheduledQuest(id);
    }
}

// ─── Send notification DM for new quest ──────────────────────────────────────
async function notifyAutoQuestStarted(user, quest) {
    const cfg = quest.config || {};
    const messages = cfg.messages || {};
    const questName = messages.quest_name || messages.questName || 'Unknown Quest';

    const expiresAt = cfg.expires_at || cfg.expiresAt;
    let expiryText = 'Unknown';
    if (expiresAt) {
        try {
            const ts = Math.floor(new Date(expiresAt).getTime() / 1000);
            expiryText = `<t:${ts}:R>`;
        } catch { expiryText = expiresAt; }
    }

    const taskConfig = cfg.task_config || cfg.task_config_v2 || cfg.taskConfigV2 || cfg.taskConfig || {};
    const tasks = taskConfig.tasks || {};
    const taskName = detectTaskName(tasks) || 'Unknown';

    try {
        const dmChannel = await user.createDM();
        await dmChannel.send(buildAutoNotifyComponents(questName, taskName, expiryText));
    } catch (err) {
        console.error(`[Notifier] Error sending auto quest notification: ${err.message}`);
    }
}

// ─── /auto command ────────────────────────────────────────────────────────────
async function handleAuto(interaction) {
    const row = getTokenRow(interaction.user.id);
    if (!row) {
        return interaction.reply({
            content: `${EMOJIES.error} Use \`/link\` first to connect your Discord account`,
            ephemeral: true,
        });
    }

    const currentStatus = row.auto_quest || 0;
    const newStatus = currentStatus ? 0 : 1;
    setAutoQuest(interaction.user.id, !!newStatus, newStatus ? 'DM' : null);

    if (newStatus) {
        await interaction.reply({
            flags: 1 << 15, // IS_COMPONENTS_V2
            components: [
                {
                    type: 17,
                    components: [
                        {
                            type: 10,
                            content: `### ${EMOJIES.success} Auto-Quest Enabled`,
                        },
                        {
                            type: 14,
                            divider: true,
                            spacing: 1,
                        },
                        {
                            type: 10,
                            content: 'Any new quest will be sent to your DM immediately and auto-start after **10 minutes**.',

/* ╔══════════════════════════════════════════════════════════════════╗
 * ║                 KSHK STORE / discord.gg/kshk                    ║
 * ║                       © KSHK Store                               ║
 * ╚══════════════════════════════════════════════════════════════════╝ */
                        },
                    ],
                },
            ],
            ephemeral: true,
        });
    } else {
        await interaction.reply({
            flags: 1 << 15,
            components: [
                {
                    type: 17,
                    components: [
                        {
                            type: 10,
                            content: `${EMOJIES.error} Auto-Quest **disabled**.`,
                        },
                    ],
                },
            ],
            ephemeral: true,
        });
    }
}

/* ╔══════════════════════════════════════════════════════════════════╗
 * ║                 KSHK STORE / discord.gg/kshk                    ║
 * ║                       © KSHK Store                               ║
 * ╚══════════════════════════════════════════════════════════════════╝ */

// ─── /checkquests command (owner only) ───────────────────────────────────────
async function handleCheckQuests(interaction) {
    const ownerId = config.OWNER_ID || interaction.user.id;
    if (String(interaction.user.id) !== String(ownerId)) {
        return interaction.reply({ content: `${EMOJIES.error} You are not authorized.`, ephemeral: true });
    }
    await interaction.reply({ content: '🔍 Checking for new quests...', ephemeral: true });
    await checkNewQuests();
    await interaction.followUp({ content: `${EMOJIES.success} Quest check complete!`, ephemeral: true });
}

// ─── Start background loops ───────────────────────────────────────────────────
function startNotifierLoops(client) {
    notifierClient = client;

    initKnownQuests();

    setInterval(() => {
        checkNewQuests().catch(err => console.error('[Notifier] checkNewQuests error:', err));
    }, 30 * 60 * 1000);

    setInterval(() => {
        checkScheduledAutoQuests().catch(err => console.error('[Notifier] checkScheduledAutoQuests error:', err));
    }, 60 * 1000);

    console.log('[Notifier] Background loops started.');
}

module.exports = {
    data: [
        new SlashCommandBuilder().setName('auto').setDescription('Enable automatic quest execution after 10 mins'),
        new SlashCommandBuilder().setName('checkquests').setDescription('Manually trigger quest check (owner only)'),
    ],
    handleAuto,
    handleCheckQuests,
    startNotifierLoops,
};
