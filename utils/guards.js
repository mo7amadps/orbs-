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
 * Must be member of the bot's server (works from DM or guild).
 */
async function requireServer(client, interaction) {
    // Inside a guild the bot is in
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

/**
 * Basic commands access:
 * - In DM: any server member
 * - In server: Starter or VIP (or Owner)
 */
async function requireMemberOrStarter(client, interaction) {
    if (await requireServer(client, interaction)) return true;

    const userId = interaction.user.id;
    if (isOwner(userId)) return false;

    const inGuild = !!interaction.guildId;

    if (!inGuild) {
        // DM: any member of the required/bot server is enough
        return false;
    }

    // Inside server: Starter or VIP only
    const starter = await isStarter(client, userId, interaction);
    const vip = await isVip(client, userId, interaction);
    if (starter || vip) return false;

    await interaction.reply({
        content: '❌ **Starter** role required to use this command **in the server**.\n(بالسيرفر لازم رول Starter — بالخاص يكفي تكون عضو)',
        ephemeral: true,
    });
    return true;
}

/**
 * Same as requireMemberOrStarter + must have chosen language
 */
async function requireStarter(client, interaction) {
    if (await requireMemberOrStarter(client, interaction)) return true;
    if (await requireLanguage(interaction)) return true;
    return false;
}

/**
 * Pro / VIP only (DM or server) — VIP role required
 */
async function requirePro(client, interaction) {
    if (await requireServer(client, interaction)) return true;
    if (await requireLanguage(interaction)) return true;

    const userId = interaction.user.id;
    if (isOwner(userId)) return false;

    const vip = await isVip(client, userId, interaction);
    if (vip) return false;

    const lang = getLanguage(userId) || 'en';
    await interaction.reply({
        content: (t(lang, 'vip_only') || '❌ VIP only.') +
            '\n(Requires **VIP** role)',
        ephemeral: true,
    });
    return true;
}

module.exports = {
    requireServer,
    requireLanguage,
    requireStart,
    requireMemberOrStarter,
    requireStarter,
    requirePro,
    isOwner,
};
