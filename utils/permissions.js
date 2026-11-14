/*
╔══════════════════════════════════════════════════════════════════════╗
║                              row                              ║
║                     © row — All Rights Reserved              ║
╚══════════════════════════════════════════════════════════════════════╝
*/
const { config } = require('./config');

/**
 * User must be inside a server where the bot is present.
 */
async function isGuildMember(client, userId, interaction = null) {
    if (interaction?.guildId) {
        const g = client.guilds.cache.get(interaction.guildId);
        if (g) return true;
    }

    const preferredId = config.REQUIRED_GUILD_ID;
    if (preferredId) {
        try {
            const guild = client.guilds.cache.get(preferredId)
                || await client.guilds.fetch(preferredId).catch(() => null);
            if (guild) {
                if (guild.members.cache.has(userId)) return true;
                const member = await guild.members.fetch(userId).catch(() => null);
                if (member) return true;
            }
        } catch { /* fall through */ }
    }

    for (const guild of client.guilds.cache.values()) {
        try {
            if (guild.members.cache.has(userId)) return true;
            const member = await guild.members.fetch(userId).catch(() => null);
            if (member) return true;
        } catch { /* continue */ }
    }
    return false;
}

function normalizeRoleIds(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
    return [String(raw)].filter(Boolean);
}

async function hasAnyRole(client, userId, roleIds, interaction = null) {
    if (!roleIds.length) return false;

    const guildsToCheck = [];
    const preferredId = config.REQUIRED_GUILD_ID || interaction?.guildId;
    if (preferredId) {
        const g = client.guilds.cache.get(preferredId)
            || await client.guilds.fetch(preferredId).catch(() => null);
        if (g) guildsToCheck.push(g);
    }
    if (interaction?.guild && !guildsToCheck.find(x => x.id === interaction.guild.id)) {
        guildsToCheck.push(interaction.guild);
    }

    for (const guild of guildsToCheck) {
        try {
            if (interaction?.member && interaction.guildId === guild.id) {
                if (roleIds.some(rid => interaction.member.roles.cache.has(String(rid)))) {
                    return true;
                }
            }
            const member = guild.members.cache.get(userId)
                || await guild.members.fetch(userId).catch(() => null);
            if (member && roleIds.some(rid => member.roles.cache.has(String(rid)))) {
                return true;
            }
        } catch { /* continue */ }
    }
    return false;
}

/**
 * VIP only — uses VIP_ROLE_IDS exclusively (never STARTER_ROLE_IDS)
 */
async function isVip(client, userId, interaction = null) {
    const roleIds = normalizeRoleIds(config.VIP_ROLE_IDS);
    return hasAnyRole(client, userId, roleIds, interaction);
}

/**
 * Starter only — uses STARTER_ROLE_IDS exclusively (never VIP_ROLE_IDS)
 * No fallback. If STARTER_ROLE_IDS is empty → nobody is Starter.
 */
async function isStarter(client, userId, interaction = null) {
    const roleIds = normalizeRoleIds(config.STARTER_ROLE_IDS);
    return hasAnyRole(client, userId, roleIds, interaction);
}

module.exports = { isGuildMember, isVip, isStarter };
