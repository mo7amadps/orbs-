/*
╔══════════════════════════════════════════════════════════════════════╗
║                                                                      ║
║                              row                              ║
║                                                                      ║
║                     © row — All Rights Reserved              ║
║                                                                      ║
║              This project is protected by row.               ║
║              Do not remove or modify this copyright notice.         ║
║                                                                      ║
╚══════════════════════════════════════════════════════════════════════╝
*/
const fs = require('fs');
const path = require('path');


/* ╔══════════════════════════════════════════════════════════════════╗
 * ║                 row                    ║
 * ║                       © row                               ║
 * ╚══════════════════════════════════════════════════════════════════╝ */
const CONFIG_FILE = path.join(__dirname, '..', 'config.json');

function loadConfig() {
    let fileConfig = {};
    if (fs.existsSync(CONFIG_FILE)) {
        fileConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    }

    // متغيرات البيئة (Railway Variables) تتغلب على config.json
    const keys = [
        'BOT_TOKEN', 'DB_NAME', 'PREFIX', 'APP_COMMAND_SYNC_SCOPE',
        'LOG_GUILD_ID', 'LOG_CHANNEL_ID',
        'LINK_LOG_GUILD_ID', 'LINK_LOG_CHANNEL_ID', 'OWNER_ID',
    ];
    for (const k of keys) {
        if (process.env[k]) fileConfig[k] = process.env[k];
    }

    if (!fileConfig.BOT_TOKEN) {
        throw new Error('BOT_TOKEN is missing. Set it in Railway Variables or config.json.');
    }
    return fileConfig;
}

const config = loadConfig();

module.exports = { config };
