/*
╔══════════════════════════════════════════════════════════════════════╗
║                              row                              ║
║                     © row — All Rights Reserved              ║
╚══════════════════════════════════════════════════════════════════════╝
*/
const { config } = require('./config');

/**
 * Check if user is member of the required guild
 */
async function isGuildMember(client, userId) {
    const guildId = config.REQUIRED_GUILD_ID;
    if (!guildId) return true;
    try {
        const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
        if (!guild) {
            for (const g of client.guilds.cache.values()) {
                const m = await g.members.fetch(userId).catch(() => null);
                if (m) return true;
            }
            return false;
        }
        const member = await guild.members.fetch(userId).catch(() => null);
        return !!member;
    } catch {
        return false;
    }
}

/**
 * Check if user has any VIP role (in required guild or any mutual guild)
 */
async function isVip(client, userId) {
    const roleIds = config.VIP_ROLE_IDS || [];
    if (!roleIds.length) return false;

    const guildId = config.REQUIRED_GUILD_ID;
    const guildsToCheck = [];

    if (guildId) {
        const g = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
        if (g) guildsToCheck.push(g);
    }
    for (const g of client.guilds.cache.values()) {
        if (!guildsToCheck.find(x => x.id === g.id)) guildsToCheck.push(g);
    }

    for (const guild of guildsToCheck) {
        try {
            const member = await guild.members.fetch(userId).catch(() => null);
            if (!member) continue;
            if (roleIds.some(rid => member.roles.cache.has(String(rid)))) {
                return true;
            }
        } catch { }
    }
    return false;
}

/**
 * Check if user has Starter role in the required server.
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
