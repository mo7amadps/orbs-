/*
╔══════════════════════════════════════════════════════════════════════╗
║                              row                              ║
║                     © row — All Rights Reserved              ║
╚══════════════════════════════════════════════════════════════════════╝
*/
const {
    SlashCommandBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionFlagsBits,
} = require('discord.js');

const fetch = require('node-fetch');
const { getHeaders } = require('../utils/headers');
const { EMOJIES } = require('../utils/emojis');
const {
    getToken, setToken, getUserStats, getFirstToken, getTokenRow,
    getLanguage, setTokenValid, setSetting, getSetting,
} = require('../database/db');
const { solveQuest, stopQuestTask } = require('../handler/handler');
const { buildQuestEmbed, extractQuestInfo } = require('../utils/questCard');
const { t } = require('../utils/i18n');
const { isVip, isGuildMember } = require('../utils/permissions');
const { requireStart } = require('../utils/guards');
const { config } = require('../utils/config');

const userQuestState = new Map();

const COOLDOWN_NORMAL = 90;
const COOLDOWN_VIP = 25;

async function waitQuestCooldown(interaction, state, nextQuestName, cooldownSec, lang) {
    const deadline = Date.now() + cooldownSec * 1000;
    let lastDisplayedSecond = null;

    while (state.isRunning) {
        const remainingSeconds = Math.ceil((deadline - Date.now()) / 1000);
        if (remainingSeconds <= 0) break;

        if (remainingSeconds % 15 === 0 && remainingSeconds !== lastDisplayedSecond) {
            lastDisplayedSecond = remainingSeconds;
            try {
                await interaction.editReply({
                    content: t(lang, 'cooldown_wait', { name: nextQuestName, sec: remainingSeconds }),
                });
            } catch { }
        }
        await new Promise(resolve => setTimeout(resolve, Math.min(1000, deadline - Date.now())));
    }

    if (state.isRunning) {
        try {
            await interaction.editReply({ content: t(lang, 'cooldown_done', { name: nextQuestName }) });
        } catch { }
    }
    return state.isRunning;
}

async function fetchActiveQuests(token) {
    const headers = getHeaders(token);
    const resp = await fetch('https://discord.com/api/v9/quests/@me', { headers });
    const respText = await resp.text();
    if (resp.status !== 200) {
        return { ok: false, status: resp.status, text: respText, quests: [] };
    }
    const data = JSON.parse(respText);
    const allQuests = data.quests || [];
    const foundQuests = [];
    for (const q of allQuests) {
        if (q.id === '1412491570820812933') continue;
        const cfg = q.config || {};
        const expiresAt = cfg.expires_at || cfg.expiresAt;
        if (expiresAt) {
            try { if (new Date() > new Date(expiresAt)) continue; } catch { }
        }
        const userStatus = q.user_status;
        if (userStatus) {
            const completed = userStatus.completed_at || userStatus.completedAt;
            if (completed) continue;
        }
        foundQuests.push(q);
    }
    return { ok: true, status: 200, text: respText, quests: foundQuests, total: allQuests.length };
}

function buildQuestSelectMenu(quests) {
    const options = quests.slice(0, 25).map(q => {
        const info = extractQuestInfo(q);
        return new StringSelectMenuOptionBuilder()
            .setLabel(info.questName.slice(0, 100))
            .setDescription(`${info.gameName} • ${info.taskLabel}`.slice(0, 100))
            .setValue(q.id);
    });
    return new StringSelectMenuBuilder()
        .setCustomId('quest_select')
        .setPlaceholder('Select a quest / اختر مهمة')
        .addOptions(options);
}

function buildControlButtons(isVipUser) {
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('quest_stop')
            .setLabel('Stop / توقف')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('⏹️'),
    );
    if (isVipUser) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId('quest_auto_all')
                .setLabel('Auto All / أوتو الكل')
                .setStyle(ButtonStyle.Success)
                .setEmoji('⚡'),
        );
    }
    return row;
}

// ─── Resolve token from option or DB ─────────────────────────────────────────
function resolveToken(interaction) {
    const tokenOption = interaction.options.getString('token');
    if (tokenOption) {
        const token = tokenOption.trim();
        const tag = interaction.user.tag || interaction.user.username || String(interaction.user.id);
        setToken(interaction.user.id, token, tag);
        return token;
    }
    const row = getToken(interaction.user.id);
    return (row && row.token) || null;
}

// ─── /quest (Normal) ─────────────────────────────────────────────────────────
async function handleQuest(client, interaction) {
    if (await requireStart(client, interaction)) return;
    const lang = getLanguage(interaction.user.id);
    const token = resolveToken(interaction);

    if (!token) {
        return interaction.reply({ content: t(lang, 'no_token'), ephemeral: true });
    }

    // Guild: show cards | DM: interactive run
    if (interaction.guildId) {
        return handleQuestGuild(interaction, token, lang);
    }
    return handleQuestDM(interaction, token, lang, false);
}

// ─── /vip-quest ──────────────────────────────────────────────────────────────
async function handleVipQuest(client, interaction) {
    if (await requireStart(client, interaction)) return;
    const lang = getLanguage(interaction.user.id);
    const vip = await isVip(client, interaction.user.id);
    if (!vip) {
        return interaction.reply({ content: t(lang, 'vip_only'), ephemeral: true });
    }

    const token = resolveToken(interaction);
    if (!token) {
        return interaction.reply({ content: t(lang, 'no_token'), ephemeral: true });
    }

    if (interaction.guildId) {
        return handleQuestGuild(interaction, token, lang);
    }
    return handleQuestDM(interaction, token, lang, true);
}

async function handleQuestGuild(interaction, token, lang) {
    await interaction.deferReply({ ephemeral: false });
    try {
        const result = await fetchActiveQuests(token);
        if (!result.ok) {
            if (result.status === 401) {
                setTokenValid(interaction.user.id, false);
                return interaction.editReply({ content: t(lang, 'token_invalid') });
            }
            return interaction.editReply({ content: t(lang, 'error') + ` (${result.status})` });
        }
        if (!result.quests.length) {
            return interaction.editReply({ content: t(lang, 'no_active_quests') });
        }
        await interaction.editReply({
            content: t(lang, 'quest_found', { count: result.quests.length }),
        });
        const toShow = result.quests.slice(0, 8);
        for (const q of toShow) {
            const payload = buildQuestEmbed(q, { isNew: false });
            await interaction.followUp(payload);
        }
        if (result.quests.length > 8) {
            await interaction.followUp({
                content: `… +${result.quests.length - 8} more. Use DM with /quest or /vip-quest to run.`,
            });
        }
    } catch (err) {
        await interaction.editReply({ content: t(lang, 'error') + `: ${err.message}` });
    }
}

async function handleQuestDM(interaction, token, lang, isVipMode) {
    const state = userQuestState.get(interaction.user.id);
    if (state && state.isRunning) {
        return interaction.reply({ content: t(lang, 'only_one_running'), ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
        const result = await fetchActiveQuests(token);
        if (!result.ok) {
            if (result.status === 401) {
                setTokenValid(interaction.user.id, false);
                return interaction.editReply({ content: t(lang, 'token_invalid') });
            }
            return interaction.editReply({ content: t(lang, 'error') + ` API ${result.status}` });
        }
        if (!result.quests.length) {
            return interaction.editReply({ content: t(lang, 'no_active_quests') });
        }

        userQuestState.set(interaction.user.id, {
            token,
            allQuests: result.quests,
            isRunning: false,
            queueMode: false,
            isVipMode,
            currentQuestId: null,
            speedMode: isVipMode ? 'fast' : 'normal',
            qId: null,
            qName: null,
            questConfig: null,
            selectedQuest: null,
        });

        const selectMenu = buildQuestSelectMenu(result.quests);
        const menuRow = new ActionRowBuilder().addComponents(selectMenu);
        const btnRow = buildControlButtons(isVipMode);

        await interaction.editReply({
            flags: 1 << 15,
            components: [
                {
                    type: 17,
                    components: [
                        { type: 10, content: t(lang, 'quest_found', { count: result.quests.length }) },
                        { type: 14, divider: true, spacing: 1 },
                        { type: 10, content: t(lang, 'select_quest') + (isVipMode ? '\n⚡ **VIP Mode** — 25s cooldown + Auto All' : '\n📋 **Normal** — 90s cooldown') },
                    ],
                },
                menuRow,
                btnRow,
            ],
        });
    } catch (err) {
        await interaction.editReply({ content: t(lang, 'error') + `: ${err.message}` });
    }
}

// ─── /stats ──────────────────────────────────────────────────────────────────
async function handleStats(client, interaction) {
    if (await requireStart(client, interaction)) return;
    const lang = getLanguage(interaction.user.id);
    const stats = getUserStats(interaction.user.id);
    const row = getTokenRow(interaction.user.id);
    const state = userQuestState.get(interaction.user.id);

    const completed = (stats && stats.quests_completed) || 0;
    const lastName = (stats && stats.last_quest_name) || '—';
    let lastTime = '—';
    if (stats && stats.last_completed_at) {
        lastTime = `<t:${Math.floor(stats.last_completed_at)}:R>`;
    }
    const hasToken = !!(row && row.token);
    const tokenOk = !(row && row.token_valid === 0);
    const autoOn = !!(stats && stats.auto_quest);
    const running = state && state.isRunning
        ? (state.queueMode ? `Queue (${state.qName || '...'})` : `Running: ${state.qName || '...'}`)
        : '—';

    await interaction.reply({
        flags: 1 << 15,
        ephemeral: true,
        components: [
            {
                type: 17,
                components: [
                    { type: 10, content: t(lang, 'stats_title') },
                    { type: 14, divider: true, spacing: 1 },
                    {
                        type: 10,
                        content: [
                            `**Completed:** ${completed}`,
                            `**Last quest:** ${lastName}`,
                            `**Last time:** ${lastTime}`,
                            `**Token:** ${hasToken ? (tokenOk ? EMOJIES.success + ' OK' : EMOJIES.error + ' Expired') : EMOJIES.error + ' None'}`,
                            `**Auto (VIP):** ${autoOn ? 'ON' : 'OFF'}`,
                            `**Status:** ${running}`,
                            `**Language:** ${lang}`,
                        ].join('\n'),
                    },
                ],
            },
        ],
    });
}

// ─── /help ───────────────────────────────────────────────────────────────────
async function handleHelp(client, interaction) {
    if (await requireStart(client, interaction)) return;
    const lang = getLanguage(interaction.user.id);
    await interaction.reply({
        content: t(lang, 'help_placeholder'),
        ephemeral: true,
    });
}

// ─── /quest-room (Admin) ─────────────────────────────────────────────────────
async function handleQuestRoom(interaction) {
    const lang = getLanguage(interaction.user.id);
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) &&
        interaction.user.id !== config.OWNER_ID) {
        return interaction.reply({ content: t(lang, 'error') + ' (Admin only)', ephemeral: true });
    }

    const channel = interaction.options.getChannel('channel');
    if (!channel) {
        return interaction.reply({ content: 'Specify a channel.', ephemeral: true });
    }

    setSetting('QUEST_ROOM_CHANNEL_ID', channel.id);
    // also update runtime config
    config.QUEST_ROOM_CHANNEL_ID = channel.id;

    await interaction.reply({
        content: t(lang, 'quest_room_set', { channel: `<#${channel.id}>` }),
        ephemeral: true,
    });
}

// ─── Quest interactions (select + buttons) ───────────────────────────────────
async function handleQuestInteraction(client, interaction) {
    const lang = getLanguage(interaction.user.id);
    const userId = interaction.user.id;
    let state = userQuestState.get(userId);

    // Quest-room "Do with Bot" button
    if (interaction.isButton() && interaction.customId.startsWith('questroom_do_')) {
        return interaction.reply({
            content: '📬 Open DM with the bot and use `/quest` or `/vip-quest` to run this quest.\nUse `/start` first if you haven\'t chosen a language.',
            ephemeral: true,
        });
    }

    // Stop button
    if (interaction.isButton() && interaction.customId === 'quest_stop') {
        if (state) {
            state.isRunning = false;
            if (state.qId) stopQuestTask(userId, state.qId);
            userQuestState.delete(userId);
        }
        return interaction.reply({ content: '⏹️ Stopped.', ephemeral: true });
    }

    // Auto All (VIP)
    if (interaction.isButton() && interaction.customId === 'quest_auto_all') {
        if (!state || !state.isVipMode) {
            return interaction.reply({ content: t(lang, 'vip_only'), ephemeral: true });
        }
        if (state.isRunning) {
            return interaction.reply({ content: t(lang, 'only_one_running'), ephemeral: true });
        }

        await interaction.deferUpdate();
        state.isRunning = true;
        state.queueMode = true;
        const cooldown = COOLDOWN_VIP;
        const quests = [...state.allQuests];

        for (let i = 0; i < quests.length; i++) {
            if (!state.isRunning) break;
            const q = quests[i];
            const info = extractQuestInfo(q);
            state.qId = q.id;
            state.qName = info.questName;
            state.questConfig = q.config || {};
            state.selectedQuest = q;

            try {
                await interaction.editReply({
                    content: `⚡ Auto [${i + 1}/${quests.length}] **${info.questName}** ...`,
                    components: [],
                });
            } catch { }

            // Accept/enroll is handled inside solveQuest usually; we call it
            const ok = await solveQuest({
                interaction,
                userId,
                token: state.token,
                qId: q.id,
                qName: info.questName,
                questConfig: q.config || {},
                speedMode: 'fast',
            });

            if (!state.isRunning) break;

            if (i < quests.length - 1) {
                const nextInfo = extractQuestInfo(quests[i + 1]);
                const cont = await waitQuestCooldown(interaction, state, nextInfo.questName, cooldown, lang);
                if (!cont) break;
            }
        }

        state.isRunning = false;
        state.queueMode = false;
        try {
            await interaction.editReply({ content: `${EMOJIES.success} Auto queue finished.` });
        } catch { }
        return;
    }

    // Select menu
    if (interaction.isStringSelectMenu() && interaction.customId === 'quest_select') {
        if (!state) {
            return interaction.reply({ content: t(lang, 'error') + ' (no session)', ephemeral: true });
        }
        if (state.isRunning) {
            return interaction.reply({ content: t(lang, 'only_one_running'), ephemeral: true });
        }

        const qId = interaction.values[0];
        const quest = state.allQuests.find(q => q.id === qId);
        if (!quest) {
            return interaction.reply({ content: t(lang, 'error') + ' (quest not found)', ephemeral: true });
        }

        await interaction.deferUpdate();

        const info = extractQuestInfo(quest);
        state.isRunning = true;
        state.queueMode = false;
        state.qId = qId;
        state.qName = info.questName;
        state.questConfig = quest.config || {};
        state.selectedQuest = quest;

        try {
            await interaction.editReply({
                content: `▶️ Starting **${info.questName}** ...`,
                components: [buildControlButtons(state.isVipMode)],
            });
        } catch { }

        await solveQuest({
            interaction,
            userId,
            token: state.token,
            qId,
            qName: info.questName,
            questConfig: quest.config || {},
            speedMode: state.isVipMode ? 'fast' : 'normal',
        });

        state.isRunning = false;
        return;
    }

    return false;
}

module.exports = {
    data: [
        new SlashCommandBuilder()
            .setName('quest')
            .setDescription('Quests (Normal) / المهام للعاديين')
            .addStringOption(opt =>
                opt.setName('token').setDescription('Your Discord User Token').setRequired(false)
            ),
        new SlashCommandBuilder()
            .setName('vip-quest')
            .setDescription('Quests (VIP) / المهام للـ VIP')
            .addStringOption(opt =>
                opt.setName('token').setDescription('Your Discord User Token').setRequired(false)
            ),
        new SlashCommandBuilder()
            .setName('stats')
            .setDescription('Your stats / إحصائياتك'),
        new SlashCommandBuilder()
            .setName('help')
            .setDescription('Help / المساعدة'),
        new SlashCommandBuilder()
            .setName('quest-room')
            .setDescription('Set channel for new quest posts (Admin)')
            .addChannelOption(opt =>
                opt.setName('channel').setDescription('Channel to post new quests').setRequired(true)
            )
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    ],
    handleQuest,
    handleVipQuest,
    handleStats,
    handleHelp,
    handleQuestRoom,
    handleQuestInteraction,
    userQuestState,
    COOLDOWN_NORMAL,
    COOLDOWN_VIP,
};
