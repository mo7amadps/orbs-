/*
╔══════════════════════════════════════════════════════════════════════╗
║                              row                              ║
║                     © row — All Rights Reserved              ║
╚══════════════════════════════════════════════════════════════════════╝
*/
const { config } = require('./config');
const { getLanguage, getTokenRow } = require('../database/db');
const { t } = require('./i18n');
const { isGuildMember } = require('./permissions');

/**
 * Enforce: user must /start first (language set) + be in the required server.
 * Returns true if blocked (already replied), false if OK to continue.
 */
async function requireStart(client, interaction) {
    const userId = interaction.user.id;
    const row = getTokenRow(userId);
    const hasLang = row && row.language;

    // 1) Must have chosen language via /start
    if (!hasLang) {
        await interaction.reply({
            content: '⚠️ لازم تستخدم `/start` أولاً واختار لغتك.\nYou must use `/start` first and choose your language.',
            ephemeral: true,
        });
        return true; // blocked
    }

    // 2) Must be member of required guild
    const member = await isGuildMember(client, userId);
    if (!member) {
        const invite = config.INVITE_LINK || 'https://discord.gg/row';
        const lang = getLanguage(userId);
        await interaction.reply({
            content: t(lang, 'must_join_server', { invite }),
            ephemeral: true,
        });
        return true; // blocked
    }

    return false; // OK
}

module.exports = { requireStart };
