/*
╔══════════════════════════════════════════════════════════════════════╗
║                              row                              ║
║                     © row — All Rights Reserved              ║
╚══════════════════════════════════════════════════════════════════════╝
*/
const { config } = require('./config');

/**
 * Check if user is member of the required guild ONLY (strict — no fallback)
 */
async function isGuildMember(client, userId) {
    const guildId = config.REQUIRED_GUILD_ID;
    if (!guildId) return true;
    try {
        const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
        if (!guild) return false;
        const member = await guild.members.fetch(userId).catch(() => null);
        return !!member;
    } catch {
        return false;
    }
}

/**
 * Check VIP role ONLY inside the required guild (strict)
 */
async function isVip(client, userId) {
    const roleIds = config.VIP_ROLE_IDS || [];
    if (!roleIds.length) return false;

    const guildId = config.REQUIRED_GUILD_ID;
    if (!guildId) return false;

    try {
        const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
        if (!guild) return false;
        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member) return false;
        return roleIds.some(rid => member.roles.cache.has(String(rid)));
    } catch {
        return false;
    }
}

/**
 * Check Starter role in the required server.
 * Falls back to VIP_ROLE_IDS if STARTER_ROLE_IDS is empty.
 */
async function isStarter(client, userId) {
    let roleIds = config.STARTER_ROLE_IDS || [];
    if (!Array.isArray(roleIds)) roleIds = roleIds ? [roleIds] : [];
    if (!roleIds.length) {
        roleIds = config.VIP_ROLE_IDS || [];
    }
    if (!roleIds.length) return false;

    const guildId = config.REQUIRED_GUILD_ID;
    if (!guildId) return false;

    try {
        const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
        if (!guild) return false;
        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member) return false;
        return roleIds.some(rid => member.roles.cache.has(String(rid)));
    } catch {
        return false;
    }
}

module.exports = { isGuildMember, isVip, isStarter };
