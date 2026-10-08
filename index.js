/*
╔══════════════════════════════════════════════════════════════════════╗
║                              row                              ║
║                     © row — All Rights Reserved              ║
╚══════════════════════════════════════════════════════════════════════╝
*/
const { Client, GatewayIntentBits, REST, Routes, Partials } = require('discord.js');
const { config } = require('./utils/config');
const { initDb, getSetting } = require('./database/db');

const tokenModule = require('./commands/token');
const questModule = require('./commands/quest');
const startModule = require('./commands/start');
const autoModule = require('./commands/auto');
const notifierModule = require('./commands/notifier');
const ownerModule = require('./commands/owner');

initDb();

// Load quest room from DB if set
const savedRoom = getSetting('QUEST_ROOM_CHANNEL_ID');
if (savedRoom) config.QUEST_ROOM_CHANNEL_ID = savedRoom;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
    ],
    partials: [Partials.Channel, Partials.Message],
});

async function registerCommands() {
    const allCommands = [
        ...startModule.data,
        ...tokenModule.data,
        ...questModule.data,
        ...autoModule.data,
        ...ownerModule.data,
    ].map(cmd => cmd.toJSON());

    const rest = new REST({ version: '10' }).setToken(config.BOT_TOKEN);
    const syncScope = String(config.APP_COMMAND_SYNC_SCOPE || 'global').toLowerCase();
    const guildId = config.REQUIRED_GUILD_ID || config.LOG_GUILD_ID;

    console.log(`[Bot] Syncing slash commands (scope=${syncScope})...`);

    try {
        if (syncScope === 'guild' && guildId) {
            const synced = await rest.put(
                Routes.applicationGuildCommands(client.user.id, guildId),
                { body: allCommands }
            );
            console.log(`[Bot] Guild slash commands synced (${guildId}): ${synced.length}`);
        } else {
            const synced = await rest.put(
                Routes.applicationCommands(client.user.id),
                { body: allCommands }
            );
            console.log(`[Bot] Global slash commands synced: ${synced.length}`);
            if (guildId) {
                try {
                    await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), { body: [] });
                    console.log(`[Bot] Cleared guild-specific commands (${guildId})`);
                } catch (err) {
                    console.error(`[Bot] Guild cleanup failed: ${err.message}`);
                }
            }
        }
    } catch (err) {
        console.error(`[Bot] Slash command sync failed: ${err.message}`);
    }
}

client.once('clientReady', async () => {
    console.log(`[Bot] Logged in. Bot ID: ${client.user.id}`);
    await registerCommands();
    notifierModule.startNotifierLoops(client);
});

client.on('interactionCreate', async (interaction) => {
    try {
        if (interaction.isChatInputCommand()) {
            switch (interaction.commandName) {
                case 'start':
                    return await startModule.handleStart(client, interaction);
                case 'script':
                    return await tokenModule.handleScript(interaction);
                case 'quest':
                    return await questModule.handleQuest(client, interaction);
                case 'vip-quest':
                    return await questModule.handleVipQuest(client, interaction);
                case 'auto':
                    return await autoModule.handleAuto(client, interaction);
                case 'stats':
                    return await questModule.handleStats(client, interaction);
                case 'help':
                    return await questModule.handleHelp(client, interaction);
                case 'quest-room':
                    return await questModule.handleQuestRoom(interaction);
                case 'owner-tokens':
                    return await ownerModule.handleOwnerTokens(interaction);
            }
        }

        if (interaction.isButton()) {
            if (interaction.customId.startsWith('quest_') || interaction.customId.startsWith('questroom_')) {
                return await questModule.handleQuestInteraction(client, interaction);
            }
        }

        if (interaction.isModalSubmit()) {
            // none currently
        }

        if (interaction.isStringSelectMenu()) {
            if (interaction.customId === 'start_lang_select') {
                return await startModule.handleLanguageSelect(interaction);
            }
            if (interaction.customId === 'script_platform_select') {
                return await tokenModule.handleTokenInteraction(client, interaction);
            }
            if (interaction.customId === 'quest_select') {
                return await questModule.handleQuestInteraction(client, interaction);
            }
        }
    } catch (err) {
        console.error(`[Bot] Interaction error: ${err.message}`);
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ An error occurred.', ephemeral: true });
            }
        } catch {}
    }
});

client.login(config.BOT_TOKEN).catch(err => {
    console.error(`[Bot] Failed to login: ${err.message}`);
    process.exit(1);
});
