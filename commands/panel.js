/*
╔══════════════════════════════════════════════════════════════════════╗
║                              row                              ║
║                     © row — All Rights Reserved              ║
╚══════════════════════════════════════════════════════════════════════╝
*/
const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
} = require('discord.js');
const {
    getTokenRow,
    getUserStats,
    getLanguage,
    setLanguage,
    setQuietMode,
    getQuietMode,
    setAutoQuest,
    getLeaderboard,
} = require('../database/db');
const { t, getLanguageOptions, LANGUAGES } = require('../utils/i18n');
const { EMOJIES } = require('../utils/emojis');
const { requireStarter, isOwner } = require('../utils/guards');
const { isVip } = require('../utils/permissions');
const { userQuestState } = require('./quest');

function buildPanelPayload(client, userId, lang) {
    const stats = getUserStats(userId);
    const row = getTokenRow(userId);
    const state = userQuestState.get(userId);
    const quiet = getQuietMode(userId);

    const completed = (stats && stats.quests_completed) || 0;
    const lastName = (stats && stats.last_quest_name) || '—';
    let lastTime = '—';
    if (stats && stats.last_completed_at) {
        lastTime = `<t:${Math.floor(stats.last_completed_at)}:R>`;
    }
    const hasToken = !!(row && row.token);
    const tokenOk = !(row && row.token_valid === 0);
    const autoOn = !!(stats && stats.auto_quest);
    const running = state && state.isRunning
        ? (state.queueMode ? `Queue (${state.qName || '...'})` : `Running: ${state.qName || '...'}`)
        : '—';
    const langInfo = LANGUAGES[lang] || { name: lang, flag: '' };

    const body = [
        `**${EMOJIES.success || '✅'} Completed:** ${completed}`,
        `**Last quest:** ${lastName}`,
        `**Last time:** ${lastTime}`,
        `**Token:** ${hasToken ? (tokenOk ? '✅ OK' : '❌ Expired') : '❌ None'}`,
        `**Auto (VIP):** ${autoOn ? '🟢 ON' : '⚪ OFF'}`,
        `**Quiet mode:** ${quiet ? '🔇 ON' : '🔊 OFF'}`,
        `**Status:** ${running}`,
        `**Language:** ${langInfo.flag} ${langInfo.name}`,
    ].join('\n');

    const container = {
        type: 17,
        components: [
            { type: 10, content: t(lang, 'panel_title') },
            { type: 14, divider: true, spacing: 1 },
            { type: 10, content: body },
            { type: 14, divider: true, spacing: 1 },
            { type: 10, content: t(lang, 'panel_hint') },
        ],
    };

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('panel_refresh')
            .setLabel('Refresh')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🔄'),
        new ButtonBuilder()
            .setCustomId('panel_quiet')
            .setLabel(quiet ? 'Quiet OFF' : 'Quiet ON')
            .setStyle(quiet ? ButtonStyle.Success : ButtonStyle.Secondary)
            .setEmoji(quiet ? '🔊' : '🔇'),
        new ButtonBuilder()
            .setCustomId('panel_leaderboard')
            .setLabel('Leaderboard')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🏆'),
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('panel_lang')
            .setLabel('Language')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🌐'),
        new ButtonBuilder()
            .setCustomId('panel_help')
            .setLabel('Help')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('📖'),
    );

    return {
        flags: 1 << 15,
        ephemeral: true,
        components: [container, row1, row2],
    };
}

async function handlePanel(client, interaction) {
    if (await requireStarter(client, interaction)) return;
    const lang = getLanguage(interaction.user.id);
    const payload = buildPanelPayload(client, interaction.user.id, lang);
    await interaction.reply(payload);
}

async function handlePanelInteraction(client, interaction) {
    const userId = interaction.user.id;
    const lang = getLanguage(userId);

    if (interaction.isButton()) {
        const id = interaction.customId;

        if (id === 'panel_refresh') {
            const payload = buildPanelPayload(client, userId, lang);
            return interaction.update(payload);
        }

        if (id === 'panel_quiet') {
            const current = getQuietMode(userId);
            setQuietMode(userId, !current);
            const payload = buildPanelPayload(client, userId, getLanguage(userId));
            return interaction.update(payload);
        }

        if (id === 'panel_leaderboard') {
            return handleLeaderboard(client, interaction, true);
        }

        if (id === 'panel_help') {
            return interaction.reply({
                content: t(lang, 'help_placeholder'),
                ephemeral: true,
            });
        }

        if (id === 'panel_lang') {
            const options = getLanguageOptions().map(o =>
                new StringSelectMenuOptionBuilder().setLabel(o.label).setValue(o.value)
            );
            const select = new StringSelectMenuBuilder()
                .setCustomId('panel_lang_select')
                .setPlaceholder('🌐 Language / اللغة')
                .addOptions(options);
            const row = new ActionRowBuilder().addComponents(select);
            return interaction.reply({
                content: t(lang, 'choose_language'),
                components: [row],
                ephemeral: true,
            });
        }
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'panel_lang_select') {
        const newLang = interaction.values[0];
        setLanguage(userId, newLang);
        const payload = buildPanelPayload(client, userId, newLang);
        // update original panel if possible; otherwise reply
        try {
            await interaction.update({
                content: t(newLang, 'language_set'),
                components: [],
            });
        } catch {
            await interaction.reply({ ...payload });
        }
        return true;
    }

    return false;
}

async function handleLeaderboard(client, interaction, fromPanel = false) {
    if (!fromPanel && (await requireStarter(client, interaction))) return;
    const lang = getLanguage(interaction.user.id);
    const rows = getLeaderboard(10);

    if (!rows.length) {
        const msg = { content: t(lang, 'leaderboard_empty'), ephemeral: true };
        if (fromPanel) return interaction.reply(msg);
        return interaction.reply(msg);
    }

    const medals = ['🥇', '🥈', '🥉'];
    const lines = rows.map((r, i) => {
        const medal = medals[i] || `**${i + 1}.**`;
        const name = `<@${r.user_id}>`;
        const count = r.quests_completed || 0;
        return `${medal} ${name} — **${count}** quests`;
    });

    const payload = {
        flags: 1 << 15,
        ephemeral: true,
        components: [
            {
                type: 17,
                components: [
                    { type: 10, content: t(lang, 'leaderboard_title') },
                    { type: 14, divider: true, spacing: 1 },
                    { type: 10, content: lines.join('\n') },
                ],
            },
        ],
    };

    if (fromPanel) return interaction.reply(payload);
    return interaction.reply(payload);
}

module.exports = {
    data: [
        new SlashCommandBuilder()
            .setName('panel')
            .setDescription('Control panel / لوحة التحكم')
            .setDMPermission(true),
        new SlashCommandBuilder()
            .setName('leaderboard')
            .setDescription('Top quest completers / ترتيب الأفضل')
            .setDMPermission(true),
    ],
    handlePanel,
    handleLeaderboard,
    handlePanelInteraction,
    buildPanelPayload,
};
