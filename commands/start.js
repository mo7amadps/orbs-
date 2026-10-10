/*
╔══════════════════════════════════════════════════════════════════════╗
║                              row                              ║
║                     © row — All Rights Reserved              ║
╚══════════════════════════════════════════════════════════════════════╝
*/
const {
    SlashCommandBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
} = require('discord.js');
const { config } = require('../utils/config');
const { t, getLanguageOptions, LANGUAGES } = require('../utils/i18n');
const { isGuildMember, isStarter, isVip } = require('../utils/permissions');
const { isOwner } = require('../utils/guards');
const { setLanguage } = require('../database/db');

async function handleStart(client, interaction) {
    const userId = interaction.user.id;
    const invite = config.INVITE_LINK || 'https://discord.gg/row';

    // Must be inside a server the bot is in
    const member = await isGuildMember(client, userId, interaction);
    if (!member && !(interaction.guildId && client.guilds.cache.has(interaction.guildId))) {
        return interaction.reply({
            content: [
                '❌ **You must join our server first.**',
                '',
                'Please join this server, then run `/start` again:',
                invite,
            ].join('\n'),
            ephemeral: true,
        });
    }

    // Starter / VIP / Owner
    if (!isOwner(userId)) {
        const starter = await isStarter(client, userId, interaction);
        const vip = await isVip(client, userId, interaction);
        if (!starter && !vip) {
            return interaction.reply({
                content: [
                    '❌ **Starter role required.**',
                    '',
                    'You need the **Starter** role in the server to use this bot.',
                ].join('\n'),
                ephemeral: true,
            });
        }
    }

    const options = getLanguageOptions().map(o =>
        new StringSelectMenuOptionBuilder().setLabel(o.label).setValue(o.value)
    );

    const select = new StringSelectMenuBuilder()
        .setCustomId('start_lang_select')
        .setPlaceholder('🌐 Language / اللغة')
        .addOptions(options);

    const row = new ActionRowBuilder().addComponents(select);

    await interaction.reply({
        content: t('en', 'start_welcome'),
        components: [row],
        ephemeral: true,
    });
}

async function handleLanguageSelect(interaction) {
    if (!interaction.isStringSelectMenu() || interaction.customId !== 'start_lang_select') return false;

    const lang = interaction.values[0];
    setLanguage(interaction.user.id, lang);

    const langInfo = LANGUAGES[lang] || { name: lang, flag: '' };
    const invite = config.INVITE_LINK || 'https://discord.gg/row';
    const mainChannelId = config.MAIN_CHANNEL_ID || process.env.MAIN_CHANNEL_ID || null;

    const lines = [
        t(lang, 'language_set') + `\n\n${langInfo.flag} **${langInfo.name}**`,
        '',
        t(lang, 'go_main_branch'),
    ];

    if (mainChannelId) {
        lines.push(`➡️ <#${mainChannelId}>`);
    }
    lines.push(invite);

    await interaction.update({
        content: lines.join('\n'),
        components: [],
    });
    return true;
}

module.exports = {
    data: [
        new SlashCommandBuilder()
            .setName('start')
            .setDescription('Start the bot & choose language / البداية واختيار اللغة')
            .setDMPermission(false),
    ],
    handleStart,
    handleLanguageSelect,
};
