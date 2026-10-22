/*
╔══════════════════════════════════════════════════════════════════════╗
║                              row                              ║
║                     © row — All Rights Reserved              ║
╚══════════════════════════════════════════════════════════════════════╝
*/
const {
    SlashCommandBuilder,
    PermissionFlagsBits,
} = require('discord.js');
const {
    addBlacklist,
    removeBlacklist,
    listBlacklist,
    isBlacklisted,
    getLanguage,
} = require('../database/db');
const { t } = require('../utils/i18n');
const { isOwner, requireServer } = require('../utils/guards');

/**
 * Discord Administrator / Manage Guild (or bot Owner) — no Starter role
 */
async function requireAdminOnly(client, interaction) {
    if (await requireServer(client, interaction)) return true;

    const userId = interaction.user.id;
    if (isOwner(userId)) return false;

    if (!interaction.guildId) {
        await interaction.reply({
            content: '❌ Use this command **inside the server**.',
            ephemeral: true,
        });
        return true;
    }

    const perms = interaction.memberPermissions;
    const isAdmin = perms && (
        perms.has(PermissionFlagsBits.Administrator) ||
        perms.has(PermissionFlagsBits.ManageGuild)
    );

    if (!isAdmin) {
        await interaction.reply({
            content: '❌ **Administrator** permission required.\nلازم صلاحية أدمن في السيرفر.',
            ephemeral: true,
        });
        return true;
    }

    return false;
}

async function handleBlacklist(client, interaction) {
    if (await requireAdminOnly(client, interaction)) return;

    const lang = getLanguage(interaction.user.id) || 'en';
    const action = interaction.options.getString('action');
    const target = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || '';

    if (action === 'list') {
        const rows = listBlacklist(30);
        if (!rows.length) {
            return interaction.reply({
                content: t(lang, 'blacklist_empty') || '📭 Blacklist is empty.',
                ephemeral: true,
            });
        }
        const lines = rows.map((r, i) => {
            const when = r.created_at ? `<t:${Math.floor(r.created_at)}:R>` : '—';
            const why = r.reason ? ` — ${r.reason}` : '';
            return `${i + 1}. <@${r.user_id}> (\`${r.user_id}\`)${why}\n   by <@${r.by_user_id}> · ${when}`;
        });
        return interaction.reply({
            content: `### 🚫 Blacklist (${rows.length})\n${lines.join('\n')}`,
            ephemeral: true,
        });
    }

    if (!target) {
        return interaction.reply({
            content: '❌ Specify a user.\nحدد مستخدم.',
            ephemeral: true,
        });
    }

    if (isOwner(target.id)) {
        return interaction.reply({ content: '❌ Cannot blacklist the bot owner.', ephemeral: true });
    }
    if (target.id === interaction.user.id) {
        return interaction.reply({ content: '❌ Cannot blacklist yourself.', ephemeral: true });
    }
    if (target.bot) {
        return interaction.reply({ content: '❌ Cannot blacklist a bot.', ephemeral: true });
    }

    if (action === 'add') {
        if (isBlacklisted(target.id)) {
            return interaction.reply({
                content: `⚠️ <@${target.id}> is already blacklisted.`,
                ephemeral: true,
            });
        }
        addBlacklist(target.id, interaction.user.id, reason);
        return interaction.reply({
            content: t(lang, 'blacklist_added', { user: `<@${target.id}>`, reason: reason || '—' }) ||
                `✅ Blacklisted <@${target.id}>.\nReason: ${reason || '—'}`,
            ephemeral: true,
        });
    }

    if (action === 'remove') {
        const ok = removeBlacklist(target.id);
        if (!ok) {
            return interaction.reply({
                content: `📭 <@${target.id}> is not on the blacklist.`,
                ephemeral: true,
            });
        }
        return interaction.reply({
            content: t(lang, 'blacklist_removed', { user: `<@${target.id}>` }) ||
                `✅ Removed <@${target.id}> from blacklist.`,
            ephemeral: true,
        });
    }

    return interaction.reply({ content: '❌ Unknown action.', ephemeral: true });
}

module.exports = {
    data: [
        new SlashCommandBuilder()
            .setName('blacklist')
            .setDescription('Blacklist a user (Admin only) / حظر مستخدم — أدمن فقط')
            .addStringOption(opt =>
                opt.setName('action')
                    .setDescription('add / remove / list')
                    .setRequired(true)
                    .addChoices(
                        { name: 'add', value: 'add' },
                        { name: 'remove', value: 'remove' },
                        { name: 'list', value: 'list' },
                    )
            )
            .addUserOption(opt =>
                opt.setName('user')
                    .setDescription('Target user (for add/remove)')
                    .setRequired(false)
            )
            .addStringOption(opt =>
                opt.setName('reason')
                    .setDescription('Reason (optional)')
                    .setRequired(false)
            )
            .setDMPermission(false)
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    ],
    handleBlacklist,
};
