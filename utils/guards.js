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
 * Must be in a server where the bot is present.
 * Returns true if blocked (already replied).
 */
async function requireServer(client, interaction) {
    // Slash used inside a guild → user is already in a bot server
    if (interaction.guildId && client.guilds.cache.has(interaction.guildId)) {
        return false;
    }

    const member = await isGuildMember(client, interaction.user.id, interaction);
    if (member) return false;

    const invite = config.INVITE_LINK || 'https://discord.gg/row';
    const lang = getLanguage(interaction.user.id) || 'en';
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

async function requireStart(client, interaction) {
    if (await requireServer(client, interaction)) return true;
    if (await requireLanguage(interaction)) return true;
    return false;
}

async function requireStarter(client, interaction) {
    if (await requireStart(client, interaction)) return true;

    const userId = interaction.user.id;
    if (isOwner(userId)) return false;

    // Starter role only (VIP is separate — higher tier also allowed)
    const starter = await isStarter(client, userId, interaction);
    const vip = await isVip(client, userId, interaction);
    if (starter || vip) return false;

    const lang = getLanguage(userId) || 'en';
    await interaction.reply({
        content: '❌ **Starter** role required.\n(رول الـ Starter منفصل عن VIP)',
        ephemeral: true,
    });
    return true;
}

async function requirePro(client, interaction) {
    if (await requireStart(client, interaction)) return true;

    const userId = interaction.user.id;
    if (isOwner(userId)) return false;

    // VIP only — Starter cannot use Pro commands
    const vip = await isVip(client, userId, interaction);
    if (vip) return false;

    const lang = getLanguage(userId) || 'en';
    await interaction.reply({
        content: (t(lang, 'vip_only') || '❌ VIP only.') +
            '\n(Requires **VIP** role — منفصل عن Starter)',
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
