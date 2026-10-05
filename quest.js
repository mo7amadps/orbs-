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
// commands/quest.js - Equivalent to cogs/quest.py

const {
    SlashCommandBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');

const fetch = require('node-fetch');
const { getHeaders } = require('../utils/headers');
const { EMOJIES } = require('../utils/emojis');
const { getToken } = require('../database/db');
const { solveQuest, stopQuestTask } = require('../handler/handler');

/* ╔══════════════════════════════════════════════════════════════════╗
 * ║                 KSHK STORE / discord.gg/kshk                    ║
 * ║                       © KSHK Store                               ║
 * ╚══════════════════════════════════════════════════════════════════╝ */

// Per-user running state
const userQuestState = new Map();
const QUEST_COOLDOWN_SECONDS = 60;

async function waitQuestCooldown(interaction, state, nextQuestName) {
    const deadline = Date.now() + QUEST_COOLDOWN_SECONDS * 1000;
    let lastDisplayedSecond = null;

    while (state.isRunning) {
        const remainingSeconds = Math.ceil((deadline - Date.now()) / 1000);
        if (remainingSeconds <= 0) break;

        if (remainingSeconds % 10 === 0 && remainingSeconds !== lastDisplayedSecond) {
            lastDisplayedSecond = remainingSeconds;
            try {
                await interaction.editReply({
                    content: `⏳ انتهت المهمة. تبدأ **${nextQuestName}** بعد ${remainingSeconds} ثانية.`,
                });
            } catch { }
        }

        await new Promise(resolve => setTimeout(resolve, Math.min(1000, deadline - Date.now())));
    }

    if (state.isRunning) {
        try {
            await interaction.editReply({ content: `✅ انتهى الانتظار. جارٍ الانتقال إلى **${nextQuestName}**.` });
        } catch { }
    }

    return state.isRunning;
}

// ─── Build Components v2 quest detail reply ────────────────────────────────────
function buildQuestDetailComponents(quest) {
    const cfg = quest.config || {};
    const messages = cfg.messages || {};
    const qName = messages.quest_name || messages.questName || 'Unknown Quest';

    const taskConfig = cfg.task_config || cfg.task_config_v2 || cfg.taskConfigV2 || cfg.taskConfig || {};
    const tasks = taskConfig.tasks || {};
    const taskName = Object.keys(tasks)[0] || 'Unknown';
    const taskData = tasks[taskName] || {};
    const secondsNeeded = taskData.target || 0;
    const minutes = Math.floor(secondsNeeded / 60);

    const rewardsConfig = cfg.rewards_config || {};
    const rewards = rewardsConfig.rewards || [];
    let rewardName = 'Unknown Reward';
    if (rewards.length) {
        const rMsg = rewards[0].messages || {};
        rewardName = rMsg.name || rMsg.name_with_article || rewards[0].reward_code || 'Unknown Reward';
    }

    const userStatus = quest.user_status || {};
    const progressData = userStatus.progress || {};
    const currentProgress = (progressData[taskName] || {}).value || 0;
    const progressPercent = secondsNeeded > 0 ? Math.floor((currentProgress / secondsNeeded) * 100) : 0;

    const expiresAt = cfg.expires_at || cfg.expiresAt;
    let expiryText = 'Unknown';
    if (expiresAt) {
        try {
            const ts = Math.floor(new Date(expiresAt).getTime() / 1000);
            expiryText = `<t:${ts}:R>`;
        } catch { expiryText = expiresAt; }
    }

    const isEnrolled = !!userStatus.enrolled_at;
    const enrollStatus = isEnrolled ? `${EMOJIES.success} Enrolled` : `${EMOJIES.error} Not Enrolled`;

    return {
        isEnrolled,
        qName,
        components_payload: {
            flags: 1 << 15,
            components: [
                {
                    type: 17,
                    components: [
                        {
                            type: 10,
                            content: `### ${qName}`,
                        },
                        {
                            type: 14,
                            divider: true,
                            spacing: 1,
                        },
                        {
                            type: 10,
                            content: [
                                `**Reward:** ${rewardName}`,
                                `**Type:** ${taskName.replace(/_/g, ' ')}`,
                                `**Time:** ${minutes} minutes`,
                                `**Progress:** ${progressPercent}%`,
                                `**Expires:** ${expiryText}`,
                                `**Status:** ${enrollStatus}`,
                                `Quest id: \`${quest.id}\``,
                            ].join('\n'),
                        },
                    ],
                },
            ],
        },
    };
}

// ─── Build quest select menu ───────────────────────────────────────────────────
function buildQuestSelectMenu(quests) {
    const options = [];

    options.push(
        new StringSelectMenuOptionBuilder()
            .setLabel('تشغيل جميع المهمات (Orbs)')
            .setValue('run_all')
            .setDescription('Run all orb-rewarding quests sequentially')
            .setEmoji({ id: '1498277075671453809', animated: true })
    );

    for (const q of quests.slice(0, 24)) {
        const cfg = q.config || {};
        const messages = cfg.messages || {};
        const name = messages.quest_name || messages.questName || 'Unknown Quest';

        const rewardsConfig = cfg.rewards_config || {};
        const rewards = rewardsConfig.rewards || [];
        const hasOrbs = rewards.some(r => (r.orb_quantity || 0) > 0);

        const emoji = hasOrbs
            ? { id: '1488640810881908736' }
            : { id: '1498275316194611272' };

        options.push(
            new StringSelectMenuOptionBuilder()
                .setLabel(name.slice(0, 100))
                .setValue(q.id)
                .setEmoji(emoji)
        );
    }


/* ╔══════════════════════════════════════════════════════════════════╗
 * ║                 KSHK STORE / discord.gg/kshk                    ║
 * ║                       © KSHK Store                               ║
 * ╚══════════════════════════════════════════════════════════════════╝ */
    return new StringSelectMenuBuilder()
        .setCustomId('quest_select')
        .setPlaceholder('Select a quest to solve...')
        .addOptions(options);
}

// ─── Build quest action buttons ────────────────────────────────────────────────
function buildQuestButtons(isEnrolled) {
    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('quest_start').setLabel('ابدأ').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('quest_normal').setLabel('Normal').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('quest_fast').setLabel('سريع').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('quest_stop').setLabel('توقـف').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('quest_enroll').setLabel('أعد').setStyle(ButtonStyle.Primary).setDisabled(isEnrolled),
    );
    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('quest_run_all').setLabel('تشغيل الكل').setStyle(ButtonStyle.Success),
    );

/* ╔══════════════════════════════════════════════════════════════════╗
 * ║                 KSHK STORE / discord.gg/kshk                    ║
 * ║                       © KSHK Store                               ║
 * ╚══════════════════════════════════════════════════════════════════╝ */
    return [row1, row2];
}

// ─── /quest command ────────────────────────────────────────────────────────────
async function handleQuest(interaction) {
    const row = getToken(interaction.user.id);
    if (!row) {
        return interaction.reply({ content: 'Use `/link` first', ephemeral: true });
    }

    const token = row.token;
    const headers = getHeaders(token);

    await interaction.deferReply({ ephemeral: false });

    try {
        const resp = await fetch('https://discord.com/api/v9/quests/@me', { headers });
        const respText = await resp.text();

        if (resp.status === 200) {
            const data = JSON.parse(respText);
            const allQuests = data.quests || [];
            const foundQuests = [];

            for (const q of allQuests) {
                const qId = q.id;
                if (qId === '1412491570820812933') continue;

                const cfg = q.config || {};
                const expiresAt = cfg.expires_at || cfg.expiresAt;
                if (expiresAt) {
                    try {
                        if (new Date() > new Date(expiresAt)) continue;
                    } catch { }
                }

                const userStatus = q.user_status;
                if (userStatus) {
                    const completed = userStatus.completed_at || userStatus.completedAt;
                    if (completed) continue;
                }

                foundQuests.push(q);
            }

            if (!foundQuests.length) {
                return interaction.followUp({ content: `No quests found (${allQuests.length} total)` });
            }

            userQuestState.set(interaction.user.id, {
                token,
                allQuests: foundQuests,
                isRunning: false,
                currentQuestId: null,

/* ╔══════════════════════════════════════════════════════════════════╗
 * ║                 KSHK STORE / discord.gg/kshk                    ║
 * ║                       © KSHK Store                               ║
 * ╚══════════════════════════════════════════════════════════════════╝ */
                speedMode: 'normal',
                qId: null,
                qName: null,
                questConfig: null,
                selectedQuest: null,
            });

            const selectMenu = buildQuestSelectMenu(foundQuests);
            const menuRow = new ActionRowBuilder().addComponents(selectMenu);

            await interaction.followUp({
                flags: 1 << 15,
                components: [
                    {
                        type: 17,
                        components: [
                            {
                                type: 10,
                                content: `### ${EMOJIES.quest} Found ${foundQuests.length} quest(s)`,
                            },
                            {
                                type: 14,
                                divider: true,
                                spacing: 1,
                            },
                            {
                                type: 10,
                                content: 'Select a quest from the menu below to view its details.',
                            },
                        ],
                    },
                    menuRow,
                ],
            });

        } else if (resp.status === 401) {
            await interaction.followUp({ content: 'Invalid token. Use `/link`' });
        } else if (resp.status === 403) {
            await interaction.followUp({ content: 'Access forbidden' });
        } else {
            await interaction.followUp({ content: `${EMOJIES.error} API Error ${resp.status}: ${respText.slice(0, 200)}` });
        }
    } catch (err) {
        await interaction.followUp({ content: `Error: ${err.message}` });
    }
}

// ─── Quest interactions (select + buttons) ────────────────────────────────────
async function handleQuestInteraction(interaction) {
    const userId = interaction.user.id;

    // Quest select menu
    if (interaction.isStringSelectMenu() && interaction.customId === 'quest_select') {
        await interaction.deferReply({ ephemeral: true });
        const state = userQuestState.get(userId);
        if (!state) return interaction.editReply({ content: `${EMOJIES.error} Session expired. Please run \`/quest\` again.` });

        const selected = interaction.values[0];

        if (selected === 'run_all') {
            state.qId = 'run_all';
            state.qName = 'تشغيل الكل';
            state.questConfig = null;
            state.selectedQuest = null;

            const runAllRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('quest_stop').setLabel('توقـف').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('quest_run_all').setLabel('تشغيل الكل').setStyle(ButtonStyle.Success),
            );

            return interaction.editReply({
                flags: 1 << 15,
                components: [
                    {
                        type: 17,
                        components: [
                            {
                                type: 10,
                                content: `### ${EMOJIES.rocket} تشغيل جميع المهمات (Orbs)`,
                            },
                            {
                                type: 14,
                                divider: true,
                                spacing: 1,
                            },
                            {
                                type: 10,
                                content: 'سيقوم البوت بتنفيذ جميع المهمات التي تعطي Orbs بالترتيب.\nاضغط على **تشغيل الكل** للبدء أو **توقف** للإلغاء.',
                            },
                        ],
                    },
                    runAllRow,
                ],
            });
        }

        const quest = state.allQuests.find(q => q.id === selected);
        if (!quest) return interaction.editReply({ content: `${EMOJIES.error} Quest not found.` });

        const cfg = quest.config || {};
        state.qId = quest.id;
        state.questConfig = cfg;
        state.selectedQuest = quest;

        const { components_payload, isEnrolled, qName } = buildQuestDetailComponents(quest);
        state.qName = qName;
        const buttons = buildQuestButtons(isEnrolled);

        return interaction.editReply({
            ...components_payload,
            components: [...components_payload.components, ...buttons],
        });
    }

    // Quest buttons
    if (interaction.isButton() && interaction.customId.startsWith('quest_')) {
        const state = userQuestState.get(userId);
        if (!state) return interaction.reply({ content: `${EMOJIES.error} Session expired. Run \`/quest\` again.`, ephemeral: true });

        const action = interaction.customId;

        if (action === 'quest_start') {
            if (state.isRunning) {
                return interaction.reply({ content: `${EMOJIES.error} Quest already running!`, ephemeral: true });
            }

            await interaction.deferReply({ ephemeral: true });
            state.isRunning = true;

            await interaction.editReply({
                content: `${EMOJIES.success} Quest started in **${state.speedMode}** mode! Check your DMs.`,
            });

            solveQuest({
                interaction,
                token: state.token,
                qId: state.qId,
                qName: state.qName,
                questConfig: state.questConfig,
                speedMode: state.speedMode,
            }).catch(err => console.error('[Quest] solveQuest error:', err))
                .finally(() => { state.isRunning = false; });

            return;
        }

        if (action === 'quest_normal') {
            if (state.isRunning) {
                stopQuestTask(userId, state.qId);
                state.speedMode = 'normal';
                await interaction.deferReply({ ephemeral: true });
                await new Promise(r => setTimeout(r, 500));
                await interaction.editReply({ content: `${EMOJIES.refresh} Quest restarted in **normal** mode!` });
                state.isRunning = true;

/* ╔══════════════════════════════════════════════════════════════════╗
 * ║                 KSHK STORE / discord.gg/kshk                    ║
 * ║                       © KSHK Store                               ║
 * ╚══════════════════════════════════════════════════════════════════╝ */
                solveQuest({ interaction, token: state.token, qId: state.qId, qName: state.qName, questConfig: state.questConfig, speedMode: 'normal' })
                    .catch(err => console.error('[Quest] solveQuest error:', err))
                    .finally(() => { state.isRunning = false; });
                return;
            } else {
                state.speedMode = 'normal';
                return interaction.reply({ content: `${EMOJIES.success} Mode set to **normal**`, ephemeral: true });
            }
        }

        if (action === 'quest_fast') {
            if (state.isRunning) {
                stopQuestTask(userId, state.qId);
                state.speedMode = 'fast';
                await interaction.deferReply({ ephemeral: true });
                await new Promise(r => setTimeout(r, 500));
                await interaction.editReply({ content: `${EMOJIES.refresh} Quest restarted in **fast** mode!` });
                state.isRunning = true;
                solveQuest({ interaction, token: state.token, qId: state.qId, qName: state.qName, questConfig: state.questConfig, speedMode: 'fast' })
                    .catch(err => console.error('[Quest] solveQuest error:', err))
                    .finally(() => { state.isRunning = false; });
                return;
            } else {
                state.speedMode = 'fast';
                return interaction.reply({ content: `${EMOJIES.success} Mode set to **fast**`, ephemeral: true });
            }
        }

        if (action === 'quest_stop') {
            if (!state.isRunning) {
                return interaction.reply({ content: `${EMOJIES.error} No quest is running!`, ephemeral: true });
            }
            stopQuestTask(userId, state.currentQuestId || state.qId);
            state.currentQuestId = null;
            state.isRunning = false;
            return interaction.reply({ content: `${EMOJIES.stop} Quest stopped!`, ephemeral: true });
        }

        if (action === 'quest_enroll') {
            await interaction.deferReply({ ephemeral: true });
            const headers = getHeaders(state.token);

            try {
                const resp = await fetch(`https://discord.com/api/v9/quests/${state.qId}/enroll`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ location: 11 }),
                });

                if ([200, 204].includes(resp.status)) {
                    const respData = resp.status === 200 ? await resp.json() : {};
                    if (respData && state.selectedQuest) {
                        state.selectedQuest.user_status = respData;
                    }
                    await interaction.followUp({ content: `${EMOJIES.success} Successfully enrolled in **${state.qName}**!`, ephemeral: true });
                } else {
                    const errText = await resp.text();
                    await interaction.followUp({ content: `${EMOJIES.error} Failed to enroll: ${errText.slice(0, 200)}`, ephemeral: true });
                }
            } catch (err) {
                await interaction.followUp({ content: `${EMOJIES.error} Error enrolling: ${err.message}`, ephemeral: true });
            }
        }

        if (action === 'quest_run_all') {
            if (state.isRunning) {
                return interaction.reply({ content: `${EMOJIES.error} A quest is already running! Please stop it first.`, ephemeral: true });
            }

            const orbQuests = state.allQuests.filter(q => {
                const cfg = q.config || {};
                const rewards = (cfg.rewards_config || {}).rewards || [];
                return rewards.some(r => (r.orb_quantity || 0) > 0);
            });

            if (!orbQuests.length) {
                return interaction.reply({ content: `${EMOJIES.error} No orb quests found.`, ephemeral: true });
            }

            await interaction.reply({
                content: `${EMOJIES.success} Started running ${orbQuests.length} Orb quests sequentially. You will receive DMs for progress.`,
                ephemeral: true,
            });

            state.isRunning = true;

            (async () => {
                try {
                    for (let index = 0; index < orbQuests.length; index++) {
                        const q = orbQuests[index];
                        if (!state.isRunning) break;

                        const cfg = q.config || {};
                        const messages = cfg.messages || {};
                        const qName = messages.quest_name || messages.questName || 'Unknown Quest';
                        state.currentQuestId = q.id;

                        const completed = await solveQuest({
                            interaction,
                            token: state.token,
                            qId: q.id,
                            qName,
                            questConfig: cfg,
                            speedMode: 'fast',
                        });

                        state.currentQuestId = null;
                        if (!state.isRunning) break;

                        const hasNextQuest = index < orbQuests.length - 1;
                        if (completed && hasNextQuest) {
                            const nextQuest = orbQuests[index + 1];
                            const nextMessages = (nextQuest.config || {}).messages || {};
                            const nextQuestName = nextMessages.quest_name || nextMessages.questName || 'Unknown Quest';
                            if (!await waitQuestCooldown(interaction, state, nextQuestName)) break;
                        }
                    }
                } catch (err) {
                    console.error(`Error in run_all: ${err}`);
                } finally {
                    state.currentQuestId = null;
                    state.isRunning = false;
                    try { await interaction.user.send({ content: `${EMOJIES.success} All orb quests have been processed!` }); } catch { }
                }
            })();
        }
    }
}

module.exports = {
    data: [
        new SlashCommandBuilder().setName('quest').setDescription('Show available quests'),
    ],
    handleQuest,
    handleQuestInteraction,
};
