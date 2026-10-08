/*
╔══════════════════════════════════════════════════════════════════════╗
║                              row                              ║
║                     © row — All Rights Reserved              ║
╚══════════════════════════════════════════════════════════════════════╝
*/
// utils/questCard.js — بطاقات مهام أنيقة للسيرفر والخاص

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
    const taskName = Object.keys(tasks)[0] || 'Unknown';
    const secondsNeeded = (tasks[taskName] && tasks[taskName].target) || 0;
    const minutes = Math.ceil(secondsNeeded / 60) || 0;

    const questName = messages.quest_name || messages.questName || 'Unknown Quest';
    const gameName =
        messages.game_title ||
        messages.game_name ||
        messages.gameName ||
        (cfg.application && (cfg.application.name || cfg.application.id)) ||
        messages.quest_name ||
        'Unknown Game';

    const taskLabel = formatTaskLabel(taskName, minutes);

    const startsAt = cfg.starts_at || cfg.startsAt || null;
    const expiresAt = cfg.expires_at || cfg.expiresAt || null;

    // صور البانر إن وجدت
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

    const rewardsConfig = cfg.rewards_config || {};
    const rewards = rewardsConfig.rewards || [];
    let rewardText = '';
    if (rewards.length) {
        const r = rewards[0];
        const rMsg = r.messages || {};
        const orbs = r.orb_quantity || 0;
        if (orbs > 0) rewardText = `${orbs} Orbs`;
        else rewardText = rMsg.name || r.reward_code || 'Reward';
    }

    return {
        id: quest.id,
        questName,
        gameName,
        taskName,
        taskLabel,
        minutes,
        startsAt,
        expiresAt,
        imageUrl,
        rewardText,
        isEnrolled: !!(quest.user_status && (quest.user_status.enrolled_at || quest.user_status.enrolledAt)),
        isCompleted: !!(quest.user_status && (quest.user_status.completed_at || quest.user_status.completedAt)),
    };
}

function formatTaskLabel(taskName, minutes) {
    const map = {
        WATCH_VIDEO: `Watch video for ${minutes} minutes`,
        WATCH_VIDEO_ON_MOBILE: `Watch on mobile for ${minutes} minutes`,
        PLAY_ON_DESKTOP: `Play on Desktop for ${minutes} minutes`,
        PLAY_ON_XBOX: `Play on Xbox for ${minutes} minutes`,
        PLAY_ON_PLAYSTATION: `Play on PlayStation for ${minutes} minutes`,
        PLAY_ACTIVITY: `Play activity for ${minutes} minutes`,
        STREAM_ON_DESKTOP: `Stream on Desktop for ${minutes} minutes`,
    };
    return map[taskName] || `${String(taskName).replace(/_/g, ' ')} (${minutes} min)`;
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

/** بطاقة Embed أنيقة لمهمة واحدة (شكل السيرفر) */
function buildQuestEmbed(quest, { isNew = false } = {}) {
    const info = extractQuestInfo(quest);
    const title = isNew
        ? `${EMOJIES.quest} مهمة جديدة: ${info.questName}`
        : `${EMOJIES.quest} ${info.questName}`;

    const embed = new EmbedBuilder()
        .setColor(isNew ? 0x57f287 : 0x5865f2)
        .setTitle(title.slice(0, 256))
        .setDescription(
            [
                `**${info.taskLabel}**`,
                '',
                `**Game Name:**\n${info.gameName}`,
                '',
                `**Quest Name:**\n${info.questName}`,
                '',
                `**Starts At:**\n${formatTime(info.startsAt)}`,
                '',
                `**Expires At:**\n${formatTime(info.expiresAt)}`,
                info.rewardText ? `\n**Reward:** ${info.rewardText}` : '',
            ].filter(Boolean).join('\n')
        )
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

/** عدة مهام كرسائل منفصلة (أو ملخص + أول بطاقة) */
function buildQuestListPayloads(quests, { isNew = false } = {}) {
    return quests.map(q => buildQuestEmbed(q, { isNew }));
}

module.exports = {
    extractQuestInfo,
    buildQuestEmbed,
    buildQuestListPayloads,
    formatTaskLabel,
    formatTime,
};
