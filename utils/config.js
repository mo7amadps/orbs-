/*
╔══════════════════════════════════════════════════════════════════════╗
║                              row                              ║
║                     © row — All Rights Reserved              ║
╚══════════════════════════════════════════════════════════════════════╝
*/
const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, '..', 'config.json');

function loadConfig() {
    let fileConfig = {};
    if (fs.existsSync(CONFIG_FILE)) {
        fileConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    }

    const keys = [
        'BOT_TOKEN', 'DB_NAME', 'PREFIX', 'APP_COMMAND_SYNC_SCOPE',
        'REQUIRED_GUILD_ID', 'INVITE_LINK', 'OWNER_ID',
        'LOG_GUILD_ID', 'LOG_CHANNEL_ID', 'QUEST_ROOM_CHANNEL_ID',
        'LINK_LOG_GUILD_ID', 'LINK_LOG_CHANNEL_ID',
    ];
    for (const k of keys) {
        if (process.env[k]) fileConfig[k] = process.env[k];
    }

    // VIP_ROLE_IDS can be comma-separated in env
    if (process.env.VIP_ROLE_IDS) {
        fileConfig.VIP_ROLE_IDS = process.env.VIP_ROLE_IDS.split(',').map(s => s.trim()).filter(Boolean);
    }
    if (!Array.isArray(fileConfig.VIP_ROLE_IDS)) {
        fileConfig.VIP_ROLE_IDS = fileConfig.VIP_ROLE_IDS ? [fileConfig.VIP_ROLE_IDS] : [];
    }

    if (!fileConfig.BOT_TOKEN) {
        throw new Error('BOT_TOKEN is missing. Set it in Railway Variables or config.json.');
    }
    return fileConfig;
}

const config = loadConfig();

module.exports = { config };
