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
// Database layer using better-sqlite3 (synchronous, replaces sqlite3 in Python)

const Database = require('better-sqlite3');
const { config } = require('../utils/config');
const path = require('path');
const fs = require('fs');

// على Railway: اربط Volume وحط DB_PATH=/data/store.db عشان ما تروح البيانات مع كل نشر
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', config.DB_NAME || 'store.db');


/* ╔══════════════════════════════════════════════════════════════════╗
 * ║                 row                    ║
 * ║                       © row                               ║
 * ╚══════════════════════════════════════════════════════════════════╝ */
let db;

function getDb() {
    if (!db) {
        // إنشاء المجلد إذا مو موجود (يمنع خطأ: directory does not exist)
        fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
        db = new Database(DB_PATH);
        db.pragma('journal_mode = WAL');
    }
    return db;
}

function initDb() {
    const database = getDb();

    // Main token table
    database.exec(`
        CREATE TABLE IF NOT EXISTS token (
            user_id TEXT PRIMARY KEY,
            token TEXT NOT NULL,
            notify_channel TEXT,
            auto_quest INTEGER DEFAULT 0
        )
    `);

    // Scheduled auto quests table
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

    // Safe migrations - add columns if missing
    try { database.exec('ALTER TABLE token ADD COLUMN notify_channel TEXT'); } catch (_) {}
    try { database.exec('ALTER TABLE token ADD COLUMN auto_quest INTEGER DEFAULT 0'); } catch (_) {}
    try { database.exec('ALTER TABLE token ADD COLUMN quests_completed INTEGER DEFAULT 0'); } catch (_) {}
    try { database.exec('ALTER TABLE token ADD COLUMN last_quest_name TEXT'); } catch (_) {}
    try { database.exec('ALTER TABLE token ADD COLUMN last_completed_at REAL'); } catch (_) {}

    console.log('[DB] Database initialized successfully.');
}

// ---------- Token helpers ----------

function getToken(userId) {
    return getDb().prepare('SELECT token FROM token WHERE user_id = ?').get(userId) || null;
}

function getTokenRow(userId) {
    return getDb().prepare('SELECT * FROM token WHERE user_id = ?').get(userId) || null;
}

function setToken(userId, token) {
    getDb().prepare('INSERT OR REPLACE INTO token (user_id, token) VALUES (?, ?)').run(userId, token);
}

function deleteToken(userId) {
    getDb().prepare('DELETE FROM token WHERE user_id = ?').run(userId);
}

function setAutoQuest(userId, enabled, notifyChannel) {
    getDb().prepare('UPDATE token SET auto_quest = ?, notify_channel = ? WHERE user_id = ?')
        .run(enabled ? 1 : 0, enabled ? notifyChannel : null, userId);
}

function getAutoQuestUsers() {
    return getDb().prepare('SELECT user_id, token, notify_channel, auto_quest FROM token WHERE auto_quest = 1').all();
}

/* ╔══════════════════════════════════════════════════════════════════╗
 * ║                 row                    ║
 * ║                       © row                               ║
 * ╚══════════════════════════════════════════════════════════════════╝ */

function getFirstToken() {
    return getDb().prepare('SELECT token FROM token LIMIT 1').get() || null;
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
        SELECT quests_completed, last_quest_name, last_completed_at, auto_quest
        FROM token WHERE user_id = ?
    `).get(userId) || null;
}

/* ╔══════════════════════════════════════════════════════════════════╗
 * ║                 row                    ║
 * ║                       © row                               ║
 * ╚══════════════════════════════════════════════════════════════════╝ */

// ---------- Scheduled auto quests helpers ----------

function scheduleAutoQuest(userId, token, qId, qName, questConfig, executeAt) {
    getDb().prepare(`
        INSERT INTO scheduled_auto_quests (user_id, token, q_id, q_name, quest_config, execute_at)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, token, qId, qName, JSON.stringify(questConfig), executeAt);
}

function getDueAutoQuests(now) {
    return getDb().prepare('SELECT * FROM scheduled_auto_quests WHERE execute_at <= ?').all(now);
}


/* ╔══════════════════════════════════════════════════════════════════╗
 * ║                 row                    ║
 * ║                       © row                               ║
 * ╚══════════════════════════════════════════════════════════════════╝ */
function deleteScheduledQuest(id) {
    getDb().prepare('DELETE FROM scheduled_auto_quests WHERE id = ?').run(id);
}

module.exports = {
    initDb,
    getDb,
    getToken,
    getTokenRow,
    setToken,
    deleteToken,
    setAutoQuest,
    getAutoQuestUsers,
    getFirstToken,
    scheduleAutoQuest,
    getDueAutoQuests,
    deleteScheduledQuest,
    incrementQuestStats,
    getUserStats,
};
