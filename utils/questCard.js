/*
╔══════════════════════════════════════════════════════════════════════╗
║                              row                              ║
║                     © row — All Rights Reserved              ║
╚══════════════════════════════════════════════════════════════════════╝
*/
const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');
const { EMOJIES } = require('./emojis');

function extractQuestInfo(quest) {
    const cfg = quest.config || {};
    const messages = cfg.messages || {};
    const taskConfig = cfg.task_config || cfg.task_config_v2 || cfg.taskConfigV2 || cfg.taskConfig || {};
    const tasks = taskConfig.tasks || {};
    const taskNames = Object.keys(tasks);
    const firstTask = taskNames[0] || 'Unknown';
    const secondsNeeded = (tasks[firstTask] && tasks[firstTask].target) || 0;
    const minutes = Math.ceil(secondsNeeded / 60) || 0;

    const questName = messages.quest_name || messages.questName || 'Unknown Quest';

    // Resolve application name/id from both old and new (taskConfigV2) structures
    let appName = null;
    let appId = null;
    if (cfg.application) {
        appName = cfg.application.name || null;
        appId = cfg.application.id || null;
    }
    if (!appId || !appName) {
        const tc = cfg.task_config || cfg.task_config_v2 || cfg.taskConfigV2 || cfg.taskConfig || {};
        const tks = tc.tasks || {};
        for (const t of Object.values(tks)) {
            const apps = t.applications || t.application || [];
            const list = Array.isArray(apps) ? apps : [apps];
            for (const a of list) {
                if (a) {
                    if (!appId && (a.id || a.application_id)) appId = a.id || a.application_id;
                    if (!appName && a.name) appName = a.name;
                }
            }
            if (appId && appName) break;
        }
    }

    const gameName =
        messages.game_title ||
        messages.game_name ||
        messages.gameName ||
        appName ||
        appId ||
        messages.quest_name ||
        'Unknown Game';

    const taskLabels = taskNames.map(tn => formatTaskLabel(tn, Math.ceil((tasks[tn]?.target || 0) / 60)));
    const isManual = taskNames.length === 0 || taskNames.every(tn => isManualTaskName(tn));
    const manualReq = isManual ? getManualRequirement(firstTask, cfg) : null;

    const startsAt = cfg.starts_at || cfg.startsAt || null;
    const expiresAt = cfg.expires_at || cfg.expiresAt || null;

    const assets = cfg.assets || cfg.assets_v2 || {};
    const hero =
        assets.hero ||
        assets.hero_image ||
        assets.quest_bar_hero ||
        messages.game_tile ||
        null;
    let imageUrl = null;
    if (typeof hero === 'string' && hero.startsWith('http')) {
        imageUrl = hero;
    } else if (hero && hero.url) {
        imageUrl = hero.url;
    }

    // Reward image if available
    let rewardImage = null;
    const rewardsConfig = cfg.rewards_config || {};
    const rewards = rewardsConfig.rewards || [];
    let rewardText = '';
    if (rewards.length) {
        const r = rewards[0];
        const rMsg = r.messages || {};
        const orbs = r.orb_quantity || 0;
        if (orbs > 0) rewardText = `${orbs} Orbs`;
        else rewardText = rMsg.name || rMsg.name_with_article || r.reward_code || 'Reward';
        // try asset
        if (r.asset || r.image || r.icon) {
            const a = r.asset || r.image || r.icon;
            rewardImage = typeof a === 'string' ? a : (a.url || null);
        }
    }

    return {
        id: quest.id,
        questName,
        gameName,
        taskName: firstTask,
        isManual,
        manualReq,
        taskLabel: taskLabels[0] || formatTaskLabel(firstTask, minutes),
        taskLabels,
        minutes,
        startsAt,
        expiresAt,
        imageUrl: imageUrl || rewardImage,
        rewardText,
        isEnrolled: !!(quest.user_status && (quest.user_status.enrolled_at || quest.user_status.enrolledAt)),
        isCompleted: !!(quest.user_status && (quest.user_status.completed_at || quest.user_status.completedAt)),
    };
}

function formatTaskLabel(taskName, minutes) {
    const map = {
        WATCH_VIDEO: `Watch video for ${minutes} minutes`,
        WATCH_VIDEO_ON_MOBILE: `Watch on mobile for ${minutes} minutes`,
        PLAY_ON_DESKTOP: `Play on Desktop for ${minutes} minutes 🖥️`,
        PLAY_ON_DESKTOP_V2: `Play on Desktop for ${minutes} minutes 🖥️`,
        PLAY_ON_XBOX: `Play on Xbox for ${minutes} minutes 🟢`,
        PLAY_ON_PLAYSTATION: `Play on PlayStation for ${minutes} minutes 🔵`,
        PLAY_ACTIVITY: `Play activity for ${minutes} minutes`,
        STREAM_ON_DESKTOP: `Stream on Desktop for ${minutes} minutes`,
        ACHIEVEMENT_IN_GAME: `In-game achievement (manual)`,
        ACHIEVEMENT_IN_ACTIVITY: `Activity achievement (manual)`,
        JOIN_GUILD: `Join server (manual)`,
        JOIN_SERVER: `Join server (manual)`,
    };
    if (map[taskName]) return map[taskName];
    const raw = String(taskName || 'Unknown').replace(/_/g, ' ');
    if (minutes > 0) return `${raw} (${minutes} min)`;
    return `${raw} (manual)`;
}

/** Tasks the bot cannot complete via API heartbeats */
function isManualTaskName(taskName) {
    if (!taskName || typeof taskName !== 'string') return true;
    const tn = taskName.toUpperCase();
    if (tn.startsWith('WATCH')) return false;
    if (tn === 'PLAY_ON_DESKTOP' || tn === 'PLAY_ON_DESKTOP_V2' || tn.startsWith('PLAY_ON_')) return false;
    if (tn.startsWith('STREAM')) return false;
    if (tn === 'PLAY_ACTIVITY') return false;
    // Everything else: achievements, join server, collect, third-party, etc.
    return true;
}

function getManualRequirement(taskName, questConfig = {}) {
    const tn = String(taskName || '').toUpperCase();
    const cfg = questConfig || {};
    const taskConfig = cfg.task_config || cfg.task_config_v2 || cfg.taskConfigV2 || cfg.taskConfig || {};
    const enrollUrl = taskConfig.enrollment_url || cfg.enrollment_url || null;

    if (tn.includes('JOIN') || tn.includes('GUILD') || tn.includes('SERVER')) {
        return {
            ar: 'لازم تدخل السيرفر يدوياً من زر Join Server داخل ديسكورد.',
            en: 'You must join the server manually via the Join Server button in Discord.',
            kind: 'join_server',
        };
    }
    if (tn.includes('ACHIEVEMENT') || tn.includes('COLLECT') || tn.includes('FIND') || tn.includes('CARD')) {
        return {
            ar: 'لازم تكمّل الشرط داخل اللعبة/التطبيق (مثلاً جمع كروت أو إنجاز معيّن) — البوت ما يقدر يسويها.',
            en: 'Complete the in-game/app requirement (e.g. collect cards or an achievement) — the bot cannot do this.',
            kind: 'achievement',
        };
    }
    if (tn.includes('LISTEN') || tn.includes('AUDIBLE') || tn.includes('SPOTIFY')) {
        return {
            ar: 'لازم تسمع المحتوى من التطبيق الرسمي يدوياً.',
            en: 'Listen to the content in the official app manually.',
            kind: 'listen',
        };
    }
    if (enrollUrl || taskConfig.type === 2) {
        return {
            ar: 'مهمة طرف ثالث — لازم تكملها من الرابط/التطبيق الخارجي يدوياً.',
            en: 'Third-party quest — complete it from the external link/app manually.',
            kind: 'third_party',
            url: enrollUrl || null,
        };
    }
    return {
        ar: 'هالنوع من المهام يدوي وما ينعمل أوتوماتيك من البوت.',
        en: 'This quest type is manual and cannot be automated by the bot.',
        kind: 'manual',
    };
}

function formatTime(iso) {
    if (!iso) return 'Unknown';
    try {
        const ts = Math.floor(new Date(iso).getTime() / 1000);
        return `<t:${ts}:f> (<t:${ts}:R>)`;
    } catch {
        return String(iso);
    }
}

/** بطاقة Embed أنيقة لمهمة واحدة (شكل السيرفر مثل الصورة) */
function buildQuestEmbed(quest, { isNew = false } = {}) {
    const info = extractQuestInfo(quest);
    const title = isNew
        ? `🎯 New Quest Available!`
        : `🎯 ${info.questName}`;

    const tasksBlock = info.taskLabels && info.taskLabels.length
        ? info.taskLabels.map(l => `• ${l}`).join('\n')
        : `• ${info.taskLabel}`;

    const desc = [
        isNew ? `**${info.questName}**\n` : '',
        `**Rewards:**`,
        info.rewardText ? `• ${info.rewardText}` : '• —',
        '',
        `**Tasks:**`,
        tasksBlock,
        '',
        `**Game Name:**`,
        info.gameName,
        '',
        `**Quest Name:**`,
        info.questName,
        '',
        `**Starts At:**`,
        formatTime(info.startsAt),
        '',
        `**Expires At:**`,
        formatTime(info.expiresAt),
    ].filter(v => v !== undefined && v !== null).join('\n');

    const embed = new EmbedBuilder()
        .setColor(isNew ? 0x57f287 : 0x5865f2)
        .setTitle(title.slice(0, 256))
        .setDescription(desc.slice(0, 4090))
        .setFooter({ text: `Quest ID: ${info.id}` })
        .setTimestamp(info.startsAt ? new Date(info.startsAt) : new Date());

    if (info.imageUrl) {
        embed.setImage(info.imageUrl);
    }

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setLabel('View Quest')
            .setStyle(ButtonStyle.Link)
            .setURL(`https://discord.com/quests/${info.id}`)
            .setEmoji('🔗'),
    );

    return { embeds: [embed], components: [row] };
}

function buildQuestListPayloads(quests, { isNew = false } = {}) {
    return quests.map(q => buildQuestEmbed(q, { isNew }));
}

module.exports = {
    isManualTaskName,
    getManualRequirement,
    extractQuestInfo,
    buildQuestEmbed,
    buildQuestListPayloads,
    formatTaskLabel,
    formatTime,
};
