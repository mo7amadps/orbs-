/*
╔══════════════════════════════════════════════════════════════════════╗
║                                                                      ║
║                  KSHK STORE  /  discord.gg/kshk                     ║
║                                                                      ║
║                     © KSHK Store — All Rights Reserved              ║
║                                                                      ║
║              This project is protected by KSHK Store.               ║
║              Do not remove or modify this copyright notice.         ║
║                                                                      ║
╚══════════════════════════════════════════════════════════════════════╝
*/
// index.js - Main entry point (equivalent to main.py)

const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
const { config } = require('./utils/config');
const { initDb } = require('./database/db');

// ─── Commands ─────────────────────────────────────────────────────────────────
const tokenModule = require('./commands/token');
const questModule = require('./commands/quest');
const notifierModule = require('./commands/notifier');

// ─── Initialize DB ─────────────────────────────────────────────────────────────
initDb();

// ─── Discord Client ────────────────────────────────────────────────────────────
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
    ],
});

// ─── Register Slash Commands ───────────────────────────────────────────────────
async function registerCommands() {
    const allCommands = [
        ...tokenModule.data,
        ...questModule.data,
        ...notifierModule.data,
    ].map(cmd => cmd.toJSON());

    const rest = new REST({ version: '10' }).setToken(config.BOT_TOKEN);
    const syncScope = String(config.APP_COMMAND_SYNC_SCOPE || 'global').toLowerCase();
    const guildId = config.LOG_GUILD_ID;

    console.log(`[Bot] Syncing slash commands (scope=${syncScope})...`);

    try {
        if (syncScope === 'guild' && guildId) {
            const synced = await rest.put(
                Routes.applicationGuildCommands(client.user.id, guildId),

/* ╔══════════════════════════════════════════════════════════════════╗
 * ║                 KSHK STORE / discord.gg/kshk                    ║
 * ║                       © KSHK Store                               ║
 * ╚══════════════════════════════════════════════════════════════════╝ */
                { body: allCommands }
            );
            console.log(`[Bot] Guild slash commands synced (${guildId}): ${synced.length}`);
        } else {
            const synced = await rest.put(
                Routes.applicationCommands(client.user.id),
                { body: allCommands }
            );
            console.log(`[Bot] Global slash commands synced: ${synced.length}`);

            // Clear old guild-specific commands if any
            if (guildId) {
                try {
                    await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), { body: [] });
                    console.log(`[Bot] Cleared guild-specific slash commands (${guildId})`);
                } catch (err) {
                    console.error(`[Bot] Guild command cleanup failed: ${err.message}`);

/* ╔══════════════════════════════════════════════════════════════════╗
 * ║                 KSHK STORE / discord.gg/kshk                    ║
 * ║                       © KSHK Store                               ║
 * ╚══════════════════════════════════════════════════════════════════╝ */
                }
            }
        }
    } catch (err) {
        console.error(`[Bot] Slash command sync failed: ${err.message}`);
    }

/* ╔══════════════════════════════════════════════════════════════════╗
 * ║                 KSHK STORE / discord.gg/kshk                    ║
 * ║                       © KSHK Store                               ║
 * ╚══════════════════════════════════════════════════════════════════╝ */
}

// ─── Ready ─────────────────────────────────────────────────────────────────────
client.once('clientReady', async () => {
    console.log(`[Bot] Logged in. Bot ID: ${client.user.id}`);
    await registerCommands();
    notifierModule.startNotifierLoops(client);
});

// ─── Interactions ──────────────────────────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {
    try {
        // ── Slash Commands ──
        if (interaction.isChatInputCommand()) {
            switch (interaction.commandName) {
                case 'link':    return await tokenModule.handleLink(interaction);
                case 'unlink':  return await tokenModule.handleUnlink(client, interaction);
                case 'script':  return await tokenModule.handleScript(interaction);
                case 'quest':   return await questModule.handleQuest(interaction);
                case 'auto':    return await notifierModule.handleAuto(interaction);
                case 'checkquests': return await notifierModule.handleCheckQuests(interaction);
            }
        }

        // ── Buttons ──
        if (interaction.isButton()) {
            // Token flow
            if (interaction.customId === 'link_token_btn') {
                return await tokenModule.handleTokenInteraction(client, interaction);
            }
            // Quest buttons
            if (interaction.customId.startsWith('quest_')) {
                return await questModule.handleQuestInteraction(interaction);
            }
        }

/* ╔══════════════════════════════════════════════════════════════════╗
 * ║                 KSHK STORE / discord.gg/kshk                    ║
 * ║                       © KSHK Store                               ║
 * ╚══════════════════════════════════════════════════════════════════╝ */

        // ── Modals ──
        if (interaction.isModalSubmit()) {
            if (interaction.customId === 'link_token_modal') {
                return await tokenModule.handleTokenInteraction(client, interaction);
            }
        }

        // ── Select Menus ──
        if (interaction.isStringSelectMenu()) {
            if (interaction.customId === 'script_platform_select') {
                return await tokenModule.handleTokenInteraction(client, interaction);
            }

/* ╔══════════════════════════════════════════════════════════════════╗
 * ║                 KSHK STORE / discord.gg/kshk                    ║
 * ║                       © KSHK Store                               ║
 * ╚══════════════════════════════════════════════════════════════════╝ */
            if (interaction.customId === 'quest_select') {
                return await questModule.handleQuestInteraction(interaction);
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

// ─── Start ─────────────────────────────────────────────────────────────────────
client.login(config.BOT_TOKEN).catch(err => {
    console.error(`[Bot] Failed to login: ${err.message}`);
    process.exit(1);
});
