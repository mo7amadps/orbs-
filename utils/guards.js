/*
╔══════════════════════════════════════════════════════════════════════╗
║                              row                              ║
║                     © row — All Rights Reserved              ║
╚══════════════════════════════════════════════════════════════════════╝
*/
const { config } = require('./config');
const { getLanguage, getTokenRow } = require('../database/db');
const { t } = require('./i18n');
const { isGuildMember, isStarter, isVip } = require('./permissions');

function isOwner(userId) {
    const ownerId = config.OWNER_ID || process.env.OWNER_ID;
    if (!ownerId) return false;
    return String(userId) === String(ownerId);
}

/**
 * Must be member of REQUIRED_GUILD_ID.
 * Returns true if blocked (already replied).
 */
async function requireServer(client, interaction) {
    const userId = interaction.user.id;
    const member = await isGuildMember(client, userId);
    if (member) return false;

    const invite = config.INVITE_LINK || 'https://discord.gg/row';
    const lang = getLanguage(userId) || 'en';
    const msg = t(lang, 'must_join_server', { invite })
        || [
            '❌ **You must join our server first.**',
            '',
            'Please join this server, then try again:',
            invite,
        ].join('\n');

    await interaction.reply({ content: msg, ephemeral: true });
    return true;
}

/**
 * Must have chosen language via /start.
 * Returns true if blocked.
 */
async function requireLanguage(interaction) {
    const userId = interaction.user.id;
    const row = getTokenRow(userId);
    const hasLang = row && row.language;
    if (hasLang) return false;

    await interaction.reply({
        content: '⚠️ لازم تستخدم `/start` أولاً واختار لغتك.\nYou must use `/start` first and choose your language.',
        ephemeral: true,
    });
    return true;
}

/**
 * Must be in server + have language set.
 * Returns true if blocked.
 */
async function requireStart(client, interaction) {
    if (await requireServer(client, interaction)) return true;
    if (await requireLanguage(interaction)) return true;
    return false;
}

/**
 * Must be in server + language + Starter role (Owner always allowed).
 * VIP also counts as Starter access for gated commands.
 * Returns true if blocked.
 */
async function requireStarter(client, interaction) {
    if (await requireStart(client, interaction)) return true;

    const userId = interaction.user.id;
    if (isOwner(userId)) return false;

    const starter = await isStarter(client, userId);
    const vip = await isVip(client, userId);
    if (starter || vip) return false;

    const lang = getLanguage(userId) || 'en';
    await interaction.reply({
        content: (t(lang, 'vip_only') || '❌ Role required.') +
            '\n(Requires **Starter** role in the server.)',
        ephemeral: true,
    });
    return true;
}

/**
 * Pro features: Starter or VIP (Owner always allowed).
 * Assumes requireStart already passed, or call standalone.
 * Returns true if blocked.
 */
async function requirePro(client, interaction) {
    if (await requireStart(client, interaction)) return true;

    const userId = interaction.user.id;
    if (isOwner(userId)) return false;

    const starter = await isStarter(client, userId);
    const vip = await isVip(client, userId);
    if (starter || vip) return false;

    const lang = getLanguage(userId) || 'en';
    await interaction.reply({
        content: (t(lang, 'vip_only') || '❌ Pro only.') +
            '\n(Requires **Starter** or **VIP** role in the server.)',
        ephemeral: true,
    });
    return true;
}

module.exports = {
    requireServer,
    requireLanguage,
    requireStart,
    requireStarter,
    requirePro,
    isOwner,
};
