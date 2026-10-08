/*
╔══════════════════════════════════════════════════════════════════════╗
║                              row                              ║
║                     © row — All Rights Reserved              ║
╚══════════════════════════════════════════════════════════════════════╝
*/
const { SlashCommandBuilder } = require('discord.js');
const { getLanguage, setAutoQuest, getTokenRow } = require('../database/db');
const { t } = require('../utils/i18n');
const { isVip } = require('../utils/permissions');
const { requireStart } = require('../utils/guards');
const { EMOJIES } = require('../utils/emojis');

async function handleAuto(client, interaction) {
    if (await requireStart(client, interaction)) return;
    const lang = getLanguage(interaction.user.id);
    const vip = await isVip(client, interaction.user.id);

    if (!vip) {
        return interaction.reply({ content: t(lang, 'vip_only'), ephemeral: true });
    }

    const row = getTokenRow(interaction.user.id);
    if (!row || !row.token) {
        return interaction.reply({ content: t(lang, 'no_token'), ephemeral: true });
    }

    const currentlyOn = !!row.auto_quest;
    const newState = !currentlyOn;

    // notify_channel = DM (we use user DM)
    setAutoQuest(interaction.user.id, newState, 'dm');

    if (newState) {
        await interaction.reply({ content: t(lang, 'auto_enabled'), ephemeral: true });
    } else {
        await interaction.reply({ content: t(lang, 'auto_disabled'), ephemeral: true });
    }
}

module.exports = {
    data: [
        new SlashCommandBuilder()
            .setName('auto')
            .setDescription('Toggle VIP auto-quest mode / تفعيل أو إيقاف الأوتو (VIP)'),
    ],
    handleAuto,
};
