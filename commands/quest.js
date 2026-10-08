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
const { getToken, setToken, getUserStats, getFirstToken } = require('../database/db');
const { solveQuest, stopQuestTask } = require('../handler/handler');
const { buildQuestEmbed, extractQuestInfo } = require('../utils/questCard');

/* ╔══════════════════════════════════════════════════════════════════╗
 * ║                 row                    ║
 * ║                       © row                               ║
 * ╚══════════════════════════════════════════════════════════════════╝ */

// Per-user running state
const userQuestState = new Map();
const QUEST_COOLDOWN_SECONDS = 90; // دقيقة ونص بين كل مهمة

async function waitQuestCooldown(interaction, state, nextQuestName, queueInfo) {
    const deadline = Date.now() + QUEST_COOLDOWN_SECONDS * 1000;
    let lastDisplayedSecond = null;
    const info = queueInfo ? ` (${queueInfo})` : '';

    while (state.isRunning) {
        const remainingSeconds = Math.ceil((deadline - Date.now()) / 1000);
        if (remainingSeconds <= 0) break;

        if (remainingSeconds % 15 === 0 && remainingSeconds !== lastDisplayedSecond) {
            lastDisplayedSecond = remainingSeconds;
            try {
                await interaction.editReply({
                    content: `⏳ خلصت المهمة. المهمة الجاية **${nextQuestName}** بعد ${remainingSeconds} ثانية${info}\nاضغط **توقف** لإلغاء الطابور.`,
                });
            } catch { }
        }

        await new Promise(resolve => setTimeout(resolve, Math.min(1000, deadline - Date.now())));
    }

    if (state.isRunning) {
        try {
            await interaction.editReply({ content: `✅ انتهى الانتظار. جاري تشغيل **${nextQuestName}**${info}` });
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
            .setLabel('تشغيل كل المهام (طابور)')
            .setValue('run_all')
            .setDescription('البوت يشغّل كل المهام بالترتيب تلقائياً — كولداون 90 ثانية')
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
 * ║                 row                    ║
 * ║                       © row                               ║
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
 * ║                 row                    ║
 * ║                       © row                               ║
 * ╚══════════════════════════════════════════════════════════════════╝ */
    return [row1, row2];
}

// ─── جلب المهام النشطة من API ─────────────────────────────────────────────────
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

// ─── /quest في السيرفر: عرض بطاقات أنيقة لكل المهام ───────────────────────────
async function handleQuestGuild(interaction) {
    // استخدم توكن المستخدم إن وجد، وإلا أول توكن محفوظ
    let token = null;
    const tokenOption = interaction.options.getString('token');
    if (tokenOption) {
        token = tokenOption.trim();
        setToken(interaction.user.id, token);
    } else {
        const row = getToken(interaction.user.id);
        token = (row && row.token) || (getFirstToken() && getFirstToken().token) || null;
    }

    if (!token) {
        return interaction.reply({
            content: `${EMOJIES.error} ما في توكن مرتبط. استخدم \`/quest token:...\` أو \`/link\` بالخاص.`,
            ephemeral: true,
        });
    }

    await interaction.deferReply({ ephemeral: false });

    try {
        const result = await fetchActiveQuests(token);
        if (!result.ok) {
            if (result.status === 401) {
                return interaction.editReply({ content: `${EMOJIES.error} التوكن غلط أو منتهي.` });
            }
            return interaction.editReply({ content: `${EMOJIES.error} خطأ API ${result.status}` });
        }

        if (!result.quests.length) {
            return interaction.editReply({ content: `${EMOJIES.success} ما في مهام نشطة حالياً.` });
        }

        // أول رسالة: ملخص
        await interaction.editReply({
            content: `${EMOJIES.quest} **المهام النشطة:** ${result.quests.length}`,
        });

        // بطاقة لكل مهمة (حد أقصى 8 عشان ما نغرق الشات)
        const toShow = result.quests.slice(0, 8);
        for (const q of toShow) {
            const payload = buildQuestEmbed(q, { isNew: false });
            await interaction.followUp(payload);
        }
        if (result.quests.length > 8) {
            await interaction.followUp({
                content: `… و ${result.quests.length - 8} مهمة إضافية. استخدم الخاص مع \`/quest\` للتشغيل.`,
            });
        }
    } catch (err) {
        await interaction.editReply({ content: `${EMOJIES.error} خطأ: ${err.message}` });
    }
}

// ─── /quest بالخاص: قائمة تفاعلية + تشغيل ─────────────────────────────────────
async function handleQuestDM(interaction) {
    const tokenOption = interaction.options.getString('token');
    let token = tokenOption ? tokenOption.trim() : null;

    if (token) {
        setToken(interaction.user.id, token);
    } else {
        const row = getToken(interaction.user.id);
        if (!row || !row.token) {
            return interaction.reply({
                content: `${EMOJIES.error} لازم تحط التوكن.\nاستخدم:\n\`/quest token:YOUR_TOKEN\`\nأو اربط التوكن أولاً بـ \`/link\``,
                ephemeral: true,
            });
        }
        token = row.token;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
        const result = await fetchActiveQuests(token);
        if (!result.ok) {
            if (result.status === 401) {
                return interaction.editReply({ content: `${EMOJIES.error} التوكن غلط أو منتهي. جرب توكن جديد.` });
            }
            if (result.status === 403) {
                return interaction.editReply({ content: `${EMOJIES.error} ممنوع الوصول (403)` });
            }
            return interaction.editReply({ content: `${EMOJIES.error} خطأ API ${result.status}: ${String(result.text).slice(0, 200)}` });
        }

        if (!result.quests.length) {
            return interaction.editReply({ content: `${EMOJIES.success} ما في مهام ناقصة. (${result.total || 0} إجمالي)` });
        }

        userQuestState.set(interaction.user.id, {
            token,
            allQuests: result.quests,
            isRunning: false,
            queueMode: false,
            currentQuestId: null,
            speedMode: 'fast',
            qId: null,
            qName: null,
            questConfig: null,
            selectedQuest: null,
        });

        const selectMenu = buildQuestSelectMenu(result.quests);
        const menuRow = new ActionRowBuilder().addComponents(selectMenu);

        await interaction.editReply({
            flags: 1 << 15,
            components: [
                {
                    type: 17,
                    components: [
                        {
                            type: 10,
                            content: `### ${EMOJIES.quest} لقيت ${result.quests.length} مهمة ناقصة`,
                        },
                        {
                            type: 14,
                            divider: true,
                            spacing: 1,
                        },
                        {
                            type: 10,
                            content: 'اختر مهمة من القائمة تحت.\nالبوت راح يبدأ يسويها تلقائياً بعد الاختيار.\nلما تخلص تقدر تستلم المكافأة من صفحة Quests في ديسكورد.',
                        },
                    ],
                },
                menuRow,
            ],
        });
    } catch (err) {
        await interaction.editReply({ content: `${EMOJIES.error} خطأ: ${err.message}` });
    }
}

// ─── /quest command ────────────────────────────────────────────────────────────
async function handleQuest(interaction) {
    // سيرفر = بطاقات عرض | خاص = تشغيل تفاعلي
    if (interaction.guildId) {
        return handleQuestGuild(interaction);
    }
    return handleQuestDM(interaction);
}

// ─── /stats ────────────────────────────────────────────────────────────────────
async function handleStats(interaction) {
    const stats = getUserStats(interaction.user.id);
    const row = getToken(interaction.user.id);
    const state = userQuestState.get(interaction.user.id);

    const completed = (stats && stats.quests_completed) || 0;
    const lastName = (stats && stats.last_quest_name) || '—';
    let lastTime = '—';
    if (stats && stats.last_completed_at) {
        lastTime = `<t:${Math.floor(stats.last_completed_at)}:R>`;
    }
    const hasToken = !!(row && row.token);
    const autoOn = !!(stats && stats.auto_quest);
    const running = state && state.isRunning
        ? (state.queueMode ? `طابور شغال (${state.qName || '...'})` : `مهمة شغالة: ${state.qName || '...'}`)
        : 'لا يوجد';

    await interaction.reply({
        flags: 1 << 15,
        ephemeral: true,
        components: [
            {
                type: 17,
                components: [
                    {
                        type: 10,
                        content: `### ${EMOJIES.orbs} إحصائياتك`,
                    },
                    {
                        type: 14,
                        divider: true,
                        spacing: 1,
                    },
                    {
                        type: 10,
                        content: [
                            `**المهام المنجزة:** ${completed}`,
                            `**آخر مهمة:** ${lastName}`,
                            `**آخر إنجاز:** ${lastTime}`,
                            `**التوكن مرتبط:** ${hasToken ? EMOJIES.success + ' نعم' : EMOJIES.error + ' لا'}`,
                            `**الوضع التلقائي:** ${autoOn ? 'مفعّل' : 'مغلق'}`,
                            `**الحالة الآن:** ${running}`,
                        ].join('\n'),
                    },
                ],
            },
        ],
    });
}

// ─── Quest interactions (select + buttons) ────────────────────────────────────
async function handleQuestInteraction(interaction) {
    const userId = interaction.user.id;

    // Quest select menu
    if (interaction.isStringSelectMenu() && interaction.customId === 'quest_select') {
        await interaction.deferReply({ ephemeral: true });
        const state = userQuestState.get(userId);
        if (!state) return interaction.editReply({ content: `${EMOJIES.error} الجلسة انتهت. اكتب \`/quest\` مرة ثانية.` });

        const selected = interaction.values[0];

        // ── تشغيل كل المهام بالترتيب (طابور تلقائي) ──
        if (selected === 'run_all') {
            if (state.isRunning) {
                return interaction.editReply({ content: `${EMOJIES.error} في مهمة/طابور شغال حالياً. وقفها أول.` });
            }

            const queue = state.allQuests.slice(); // كل المهام الناقصة بالترتيب
            if (!queue.length) {
                return interaction.editReply({ content: `${EMOJIES.error} ما في مهام ناقصة.` });
            }

            state.isRunning = true;
            state.speedMode = 'fast';
            state.queueMode = true;

            const stopRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('quest_stop').setLabel('توقـف الطابور').setStyle(ButtonStyle.Danger),
            );

            await interaction.editReply({
                content: [
                    `${EMOJIES.rocket} **بدأ الطابور التلقائي**`,
                    `عدد المهام: **${queue.length}**`,
                    `كولداون بين كل مهمة: **90 ثانية**`,
                    `البوت يشغّل المهام لحاله بالترتيب.`,
                    `تابع التقدم في الخاص (DM).`,
                    `اضغط **توقف الطابور** في أي وقت للإلغاء.`,
                ].join('\n'),
                components: [stopRow],
            });

            (async () => {
                let doneCount = 0;
                try {
                    for (let index = 0; index < queue.length; index++) {
                        if (!state.isRunning) break;

                        const q = queue[index];
                        const cfg = q.config || {};
                        const messages = cfg.messages || {};
                        const qName = messages.quest_name || messages.questName || 'Unknown Quest';
                        const queueInfo = `${index + 1}/${queue.length}`;

                        state.currentQuestId = q.id;
                        state.qId = q.id;
                        state.qName = qName;
                        state.questConfig = cfg;

                        try {
                            await interaction.editReply({
                                content: `${EMOJIES.rocket} جاري تشغيل **${qName}** (${queueInfo})\nاضغط **توقف الطابور** للإلغاء.`,
                                components: [stopRow],
                            });
                        } catch { }

                        const completed = await solveQuest({
                            interaction,
                            token: state.token,
                            qId: q.id,
                            qName,
                            questConfig: cfg,
                            speedMode: 'fast',
                        });

                        state.currentQuestId = null;
                        if (completed) doneCount++;
                        if (!state.isRunning) break;

                        const hasNext = index < queue.length - 1;
                        if (hasNext) {
                            const nextQuest = queue[index + 1];
                            const nextMessages = (nextQuest.config || {}).messages || {};
                            const nextQuestName = nextMessages.quest_name || nextMessages.questName || 'Unknown Quest';
                            if (!await waitQuestCooldown(interaction, state, nextQuestName, `${index + 2}/${queue.length}`)) break;
                        }
                    }
                } catch (err) {
                    console.error(`Error in queue run_all: ${err}`);
                } finally {
                    const wasStopped = !state.isRunning && doneCount < queue.length;
                    state.currentQuestId = null;
                    state.isRunning = false;
                    state.queueMode = false;
                    try {
                        if (wasStopped) {
                            await interaction.user.send({
                                content: `${EMOJIES.stop} توقف الطابور.\nتم إنجاز **${doneCount}** من **${queue.length}** مهمة.\nتقدر ترجع تشغّل \`/quest\` في أي وقت.`,
                            });
                        } else {
                            await interaction.user.send({
                                content: `${EMOJIES.success} خلص الطابور!\nتم إنجاز **${doneCount}** من **${queue.length}** مهمة.\nروح لصفحة **Quests** واستلم المكافآت.`,
                            });
                        }
                    } catch { }
                }
            })();

            return;
        }

        // ── اختيار مهمة واحدة → البوت يبدأ مباشرة ──
        const quest = state.allQuests.find(q => q.id === selected);
        if (!quest) return interaction.editReply({ content: `${EMOJIES.error} المهمة مش موجودة.` });

        if (state.isRunning) {
            return interaction.editReply({ content: `${EMOJIES.error} في مهمة شغالة حالياً. وقفها أول بـ زر توقف.` });
        }

        const cfg = quest.config || {};
        const messages = cfg.messages || {};
        const qName = messages.quest_name || messages.questName || 'Unknown Quest';

        state.qId = quest.id;
        state.questConfig = cfg;
        state.selectedQuest = quest;
        state.qName = qName;
        state.speedMode = 'fast';
        state.isRunning = true;
        state.currentQuestId = quest.id;

        const stopRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('quest_stop').setLabel('توقـف').setStyle(ButtonStyle.Secondary),
        );

        await interaction.editReply({
            content: `${EMOJIES.success} بدأت مهمة **${qName}**\nتابع التقدم في الخاص (DM).\nلما تخلص تقدر تستلم المكافأة من صفحة Quests في ديسكورد.`,
            components: [stopRow],
        });

        solveQuest({
            interaction,
            token: state.token,
            qId: state.qId,
            qName: state.qName,
            questConfig: state.questConfig,
            speedMode: 'fast',
        })
            .then(async (completed) => {
                if (completed) {
                    try {
                        await interaction.user.send({
                            content: `${EMOJIES.success} خلصت مهمة **${qName}**!\nروح لصفحة **Quests** في ديسكورد واضغط **Claim** عشان تستلم المكافأة.`,
                        });
                    } catch { }
                }
            })
            .catch(err => console.error('[Quest] solveQuest error:', err))
            .finally(() => {
                state.isRunning = false;
                state.currentQuestId = null;
            });

        return;
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
 * ║                 row                    ║
 * ║                       © row                               ║
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
                return interaction.reply({ content: `${EMOJIES.error} ما في مهمة أو طابور شغال حالياً.`, ephemeral: true });
            }
            stopQuestTask(userId, state.currentQuestId || state.qId);
            const wasQueue = !!state.queueMode;
            state.currentQuestId = null;
            state.isRunning = false;
            state.queueMode = false;
            return interaction.reply({
                content: wasQueue
                    ? `${EMOJIES.stop} تم إيقاف **الطابور**. ما راح تكمل المهام الباقية.`
                    : `${EMOJIES.stop} تم إيقاف المهمة.`,
                ephemeral: true,
            });
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
            // نفس منطق الطابور من القائمة — للتوافق مع الزر القديم
            if (state.isRunning) {
                return interaction.reply({ content: `${EMOJIES.error} في مهمة/طابور شغال. وقفها أول.`, ephemeral: true });
            }

            const queue = (state.allQuests || []).slice();
            if (!queue.length) {
                return interaction.reply({ content: `${EMOJIES.error} ما في مهام ناقصة.`, ephemeral: true });
            }

            state.isRunning = true;
            state.speedMode = 'fast';
            state.queueMode = true;

            await interaction.reply({
                content: `${EMOJIES.rocket} بدأ الطابور: **${queue.length}** مهمة — كولداون 90 ثانية بين كل واحدة.`,
                ephemeral: true,
            });

            (async () => {
                let doneCount = 0;
                try {
                    for (let index = 0; index < queue.length; index++) {
                        if (!state.isRunning) break;
                        const q = queue[index];
                        const cfg = q.config || {};
                        const messages = cfg.messages || {};
                        const qName = messages.quest_name || messages.questName || 'Unknown Quest';
                        state.currentQuestId = q.id;
                        state.qId = q.id;
                        state.qName = qName;
                        state.questConfig = cfg;

                        const completed = await solveQuest({
                            interaction,
                            token: state.token,
                            qId: q.id,
                            qName,
                            questConfig: cfg,
                            speedMode: 'fast',
                        });

                        state.currentQuestId = null;
                        if (completed) doneCount++;
                        if (!state.isRunning) break;

                        if (index < queue.length - 1) {
                            const nextQuest = queue[index + 1];
                            const nextMessages = (nextQuest.config || {}).messages || {};
                            const nextQuestName = nextMessages.quest_name || nextMessages.questName || 'Unknown Quest';
                            if (!await waitQuestCooldown(interaction, state, nextQuestName, `${index + 2}/${queue.length}`)) break;
                        }
                    }
                } catch (err) {
                    console.error(`Error in queue run_all button: ${err}`);
                } finally {
                    state.currentQuestId = null;
                    state.isRunning = false;
                    state.queueMode = false;
                    try {
                        await interaction.user.send({
                            content: `${EMOJIES.success} خلص الطابور! تم **${doneCount}/${queue.length}**.\nروح لصفحة Quests واستلم المكافآت.`,
                        });
                    } catch { }
                }
            })();
        }
    }
}

module.exports = {
    data: [
        new SlashCommandBuilder()
            .setName('quest')
            .setDescription('عرض المهام (بالسيرفر بطاقات | بالخاص تشغيل)')
            .addStringOption(opt =>
                opt
                    .setName('token')
                    .setDescription('توكن ديسكورد تبعك (User Token)')
                    .setRequired(false)
            ),
        new SlashCommandBuilder()
            .setName('stats')
            .setDescription('إحصائياتك: المهام المنجزة والحالة'),
    ],
    handleQuest,
    handleStats,
    handleQuestInteraction,
};
