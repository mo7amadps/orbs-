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
const { isGuildMember } = require('../utils/permissions');
const { setLanguage } = require('../database/db');

async function handleStart(client, interaction) {
    const userId = interaction.user.id;
    const member = await isGuildMember(client, userId);
    const invite = config.INVITE_LINK || 'https://discord.gg/row';

    // Must be in the required server first — English only
    if (!member) {
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
    await interaction.update({
        content: t(lang, 'language_set') + `\n\n${langInfo.flag} **${langInfo.name}**`,
        components: [],
    });
    return true;
}

module.exports = {
    data: [
        new SlashCommandBuilder()
            .setName('start')
            .setDescription('Start the bot & choose language / البداية واختيار اللغة'),
    ],
    handleStart,
    handleLanguageSelect,
};
