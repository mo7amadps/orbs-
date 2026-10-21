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
// handler.js - Quest execution engine

const fetch = require('node-fetch');
const { getHeaders } = require('../utils/headers');
const { EMOJIES } = require('../utils/emojis');
const { incrementQuestStats, getQuietMode } = require('../database/db');

const CLAIM_REMINDER_MS = 3 * 60 * 1000; // 3 دقائق

// Map: `${userId}_${qId}` => { cancelled: bool }
const runningTasks = new Map();

function stopQuestTask(userId, qId) {
    const key = `${userId}_${qId}`;
    const ctrl = runningTasks.get(key);
    if (ctrl) {
        ctrl.cancelled = true;
        runningTasks.delete(key);
        return true;
    }
    return false;
}

// ─── Detect task name from tasks object ───────────────────────────────────────
function detectTaskName(tasks) {
    const TASK_PRIORITY = ['WATCH_VIDEO', 'WATCH_VIDEO_ON_MOBILE', 'PLAY_ON_DESKTOP', 'PLAY_ACTIVITY'];
    return TASK_PRIORITY.find(t => t in tasks) || Object.keys(tasks)[0] || null;
}

/** Visual progress bar e.g. ████████░░ 80% */
function progressBar(percent, width = 12) {
    const p = Math.max(0, Math.min(100, Math.floor(percent)));
    const filled = Math.round((p / 100) * width);
    const empty = width - filled;
    return '█'.repeat(filled) + '░'.repeat(empty) + ` ${p}%`;
}

// ─── Build Components v2 progress message ─────────────────────────────────────
function buildProgressComponents(title, lines, opts = {}) {
    const last10 = lines.slice(-10).join('\n');
    const barLine = typeof opts.percent === 'number'
        ? `\`${progressBar(opts.percent)}\``
        : null;
    const body = [barLine, '```ruby', last10 || '...', '```'].filter(Boolean).join('\n');
    return {
        flags: 1 << 15, // IS_COMPONENTS_V2
        components: [
            {
                type: 17, // Container
                components: [
                    {
                        type: 10, // Text Display
                        content: `### ${title}`,
                    },
                    {
                        type: 14, // Separator
                        divider: true,
                        spacing: 1,
                    },
                    {
                        type: 10, // Text Display
                        content: body,
                    },
                ],
            },
        ],
    };
}

// Sleep helper
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/** Fetch with simple retry on network / 429 / 5xx */
async function fetchWithRetry(url, options, { retries = 3, baseDelay = 2000 } = {}) {
    let lastErr = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const resp = await fetch(url, options);
            if (resp.status === 429 || resp.status >= 500) {
                const wait = baseDelay * Math.pow(2, attempt);
                await sleep(wait);
                lastErr = new Error(`HTTP ${resp.status}`);
                continue;
            }
            return resp;
        } catch (err) {
            lastErr = err;
            if (attempt < retries) await sleep(baseDelay * Math.pow(2, attempt));
        }
    }
    throw lastErr || new Error('fetch failed');
}

// ─── Video Quest ───────────────────────────────────────────────────────────────
async function handleVideoQuest({ dmMessage, headers, qId, qName, secondsNeeded, ctrl }) {
    const startTime = Date.now();
    let secondsDone = 0;

/* ╔══════════════════════════════════════════════════════════════════╗
 * ║                 row                    ║
 * ║                       © row                               ║
 * ╚══════════════════════════════════════════════════════════════════╝ */
    const progressLines = [];
    let completed = false;
    const interval = 15000;

    await dmMessage.edit(buildProgressComponents(qName, ['Starting video quest (Real-time required)...']));

    while (!completed && secondsDone < secondsNeeded) {
        if (ctrl.cancelled) {
            await dmMessage.edit(buildProgressComponents('Quest Stopped', ['Quest was stopped by user.']));
            return false;
        }
        await sleep(interval);
        if (ctrl.cancelled) {
            await dmMessage.edit(buildProgressComponents('Quest Stopped', ['Quest was stopped by user.']));
            return false;
        }

        const elapsed = (Date.now() - startTime) / 1000;
        const timestamp = Math.min(secondsNeeded, elapsed);

        let resp;
        try {
            resp = await fetchWithRetry(`https://discord.com/api/v9/quests/${qId}/video-progress`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ timestamp }),
            }, { retries: 2, baseDelay: 2500 });
        } catch (err) {
            progressLines.push(`[ERROR] Network error: ${err.message.slice(0, 80)}`);
            await dmMessage.edit(buildProgressComponents('Quest Error', progressLines));
            return false;
        }

        if (resp.status !== 200) {
            const errText = await resp.text();
            progressLines.push(`[ERROR] API returned ${resp.status}: ${errText.slice(0, 100)}`);
            await dmMessage.edit(buildProgressComponents('Quest Error', progressLines));
            return false;
        }

        const data = await resp.json();
        completed = data.completed_at != null;
        secondsDone = timestamp;

        const percent = Math.floor((secondsDone / secondsNeeded) * 100);
        progressLines.push(`[PROGRESS] ${Math.floor(secondsDone)}/${secondsNeeded}s`);
        if (progressLines.length > 8) progressLines.splice(0, progressLines.length - 8);

        await dmMessage.edit(
            buildProgressComponents(completed ? 'Quest Completed!' : qName, progressLines, { percent })
        );
    }

    if (!completed) {
        await sleep(2000);
        try {
            await fetch(`https://discord.com/api/v9/quests/${qId}/video-progress`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ timestamp: secondsNeeded }),
            });
        } catch { }
    }

    progressLines.push('[DONE] 100%');
    progressLines.push('✅ Done — claim reward:');
    progressLines.push(`🔗 https://discord.com/quests/${qId}`);
    progressLines.push('Or use /claim');
    await dmMessage.edit(buildProgressComponents('Quest Completed!', progressLines, { percent: 100 }));
    return true;
}

// ─── Play Quest ────────────────────────────────────────────────────────────────
async function handlePlayQuest({ dmMessage, headers, qId, qName, secondsNeeded, questConfig, speedMode = 'normal', ctrl }) {
    const appId = questConfig?.application?.id;
    if (!appId) {
        await dmMessage.edit(buildProgressComponents(qName, [`${EMOJIES.error} Application ID missing`]));
        return false;
    }

    const interval = speedMode === 'fast' ? 30000 : 60000;
    let secondsDone = 0;
    const progressLines = [];
    let uiCounter = 0;
    const uiThrottle = speedMode === 'fast' ? 2 : 1;

    await dmMessage.edit(buildProgressComponents(qName, ['Starting quest...']));

    while (secondsDone < secondsNeeded) {
        if (ctrl.cancelled) {
            try {
                await fetch(`https://discord.com/api/v9/quests/${qId}/heartbeat`, {
                    method: 'POST', headers,
                    body: JSON.stringify({ application_id: appId, terminal: true }),
                });
            } catch { }
            await dmMessage.edit(buildProgressComponents('Quest Stopped', ['Quest was stopped by user.']));
            return false;
        }

        let resp;
        try {
            resp = await fetchWithRetry(`https://discord.com/api/v9/quests/${qId}/heartbeat`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ application_id: appId, terminal: false }),
            }, { retries: 2, baseDelay: 3000 });
        } catch (err) {
            console.error(`[Handler] heartbeat fetch error: ${err.message}`);
            progressLines.push(`[ERROR] ${err.message.slice(0, 80)}`);
            await dmMessage.edit(buildProgressComponents('Quest Error', progressLines));
            return false;
        }

        if (resp.status !== 200) {
            progressLines.push(`[ERROR] heartbeat ${resp.status}`);
            await dmMessage.edit(buildProgressComponents('Quest Error', progressLines));
            return false;
        }

        const data = await resp.json();
        secondsDone = data?.progress?.PLAY_ON_DESKTOP?.value || 0;
        const percent = Math.floor((secondsDone / secondsNeeded) * 100);
        uiCounter++;

        if (uiCounter >= uiThrottle || secondsDone >= secondsNeeded) {
            progressLines.push(`[PROGRESS] ${Math.floor(secondsDone)}/${secondsNeeded}s`);
            if (progressLines.length > 8) progressLines.splice(0, progressLines.length - 8);
            await dmMessage.edit(buildProgressComponents(qName, progressLines, { percent }));
            uiCounter = 0;
        }

        await sleep(interval);
    }

    try {
        await fetch(`https://discord.com/api/v9/quests/${qId}/heartbeat`, {
            method: 'POST', headers,
            body: JSON.stringify({ application_id: appId, terminal: true }),
        });
    } catch { }

    progressLines.push('[DONE] 100%');
    progressLines.push('✅ Done — claim reward:');
    progressLines.push(`🔗 https://discord.com/quests/${qId}`);
    progressLines.push('Or use /claim');
    await dmMessage.edit(buildProgressComponents('Quest Completed!', progressLines, { percent: 100 }));
    return true;
}

// ─── Activity Quest ────────────────────────────────────────────────────────────
async function handleActivityQuest({ dmMessage, headers, qId, qName, secondsNeeded, speedMode = 'normal', ctrl }) {
    const streamKey = 'call:1:1';
    const interval = speedMode === 'fast' ? 10000 : 20000;
    let secondsDone = 0;
    const progressLines = [];
    let uiCounter = 0;
    const uiThrottle = speedMode === 'fast' ? 2 : 1;

    await dmMessage.edit(buildProgressComponents(qName, ['Starting quest...']));

    while (secondsDone < secondsNeeded) {
        if (ctrl.cancelled) {
            try {
                await fetch(`https://discord.com/api/v9/quests/${qId}/heartbeat`, {
                    method: 'POST', headers,
                    body: JSON.stringify({ stream_key: streamKey, terminal: true }),
                });
            } catch { }
            await dmMessage.edit(buildProgressComponents('Quest Stopped', ['Quest was stopped by user.']));
            return false;
        }

        let resp;
        try {
            resp = await fetchWithRetry(`https://discord.com/api/v9/quests/${qId}/heartbeat`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ stream_key: streamKey, terminal: false }),
            }, { retries: 2, baseDelay: 3000 });
        } catch (err) {
            console.error(`[Handler] heartbeat fetch error: ${err.message}`);
            progressLines.push(`[ERROR] ${err.message.slice(0, 80)}`);
            await dmMessage.edit(buildProgressComponents('Quest Error', progressLines));
            return false;
        }

        if (resp.status !== 200) {
            progressLines.push(`[ERROR] heartbeat ${resp.status}`);
            await dmMessage.edit(buildProgressComponents('Quest Error', progressLines));
            return false;
        }

        const data = await resp.json();
        secondsDone = data?.progress?.PLAY_ACTIVITY?.value || 0;
        const percent = Math.floor((secondsDone / secondsNeeded) * 100);
        uiCounter++;

        if (uiCounter >= uiThrottle || secondsDone >= secondsNeeded) {
            progressLines.push(`[PROGRESS] ${Math.floor(secondsDone)}/${secondsNeeded}s`);
            if (progressLines.length > 8) progressLines.splice(0, progressLines.length - 8);
            await dmMessage.edit(buildProgressComponents(qName, progressLines, { percent }));
            uiCounter = 0;
        }

        await sleep(interval);
    }

    try {
        await fetch(`https://discord.com/api/v9/quests/${qId}/heartbeat`, {
            method: 'POST', headers,
            body: JSON.stringify({ stream_key: streamKey, terminal: true }),
        });
    } catch { }

    progressLines.push('[DONE] 100%');
    progressLines.push('✅ Done — claim reward:');
    progressLines.push(`🔗 https://discord.com/quests/${qId}`);
    progressLines.push('Or use /claim');
    await dmMessage.edit(buildProgressComponents('Quest Completed!', progressLines, { percent: 100 }));
    return true;
}

// ─── Core quest runner ────────────────────────────────────────────────────────
async function runQuest({ dmMessage, headers, qId, qName, questConfig, speedMode, ctrl }) {
    const taskConfig = questConfig.task_config || questConfig.task_config_v2 || questConfig.taskConfigV2 || questConfig.taskConfig || {};
    const tasks = taskConfig.tasks || {};

    const taskName = detectTaskName(tasks);

    if (!taskName) {
        await dmMessage.edit(buildProgressComponents(qName, [`${EMOJIES.error} Unknown quest type`]));
        return false;
    }

    const secondsNeeded = tasks[taskName]?.target;
    if (!secondsNeeded) {
        await dmMessage.edit(buildProgressComponents(qName, [`${EMOJIES.error} Missing quest target time`]));
        return false;
    }

    if (taskName.startsWith('WATCH')) {
        return handleVideoQuest({ dmMessage, headers, qId, qName, secondsNeeded, ctrl });
    } else if (taskName === 'PLAY_ON_DESKTOP') {
        return handlePlayQuest({ dmMessage, headers, qId, qName, secondsNeeded, questConfig, speedMode, ctrl });
    } else if (taskName === 'PLAY_ACTIVITY') {
        return handleActivityQuest({ dmMessage, headers, qId, qName, secondsNeeded, speedMode, ctrl });
    }

    await dmMessage.edit(buildProgressComponents(qName, [`${EMOJIES.error} Unsupported quest task: ${taskName}`]));
    return false;
}

// ─── Solve Quest (interactive - triggered by slash command) ────────────────────
// sendClaimReminder:
//   true  = تذكير بعد كل مهمة (وضع عادي /quest)
//   false = بدون تذكير (VIP أثناء Auto All — التذكير مرة واحدة بعد ما تخلص كل المهام)
async function solveQuest({ interaction, token, qId, qName, questConfig, speedMode = 'normal', sendClaimReminder = true }) {
    const headers = getHeaders(token);

    let dmMessage;
    try {
        const dmChannel = await interaction.user.createDM();
        dmMessage = await dmChannel.send(buildProgressComponents(qName, ['Enrolling...']));
    } catch {
        try {
            await interaction.followUp({
                content: `${EMOJIES.error} Could not send DM. Please enable DMs from server members.`,
                ephemeral: true,
            });
        } catch { }
        return false;
    }

    let enrollResp;
    try {
        enrollResp = await fetch(`https://discord.com/api/v9/quests/${qId}/enroll`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ location: 11 }),
        });
    } catch (err) {
        await dmMessage.edit(buildProgressComponents(qName, [`${EMOJIES.error} Network error during enroll`]));
        return false;
    }

    if (![200, 204].includes(enrollResp.status)) {
        const errText = await enrollResp.text().catch(() => '');
        await dmMessage.edit(buildProgressComponents(qName, [`${EMOJIES.error} Enroll failed (${enrollResp.status})`, errText.slice(0, 100)]));
        return false;
    }

    const key = `${interaction.user.id}_${qId}`;
    const ctrl = { cancelled: false };
    runningTasks.set(key, ctrl);

    try {
        const completed = await runQuest({ dmMessage, headers, qId, qName, questConfig, speedMode, ctrl });
        if (completed) {
            try { incrementQuestStats(interaction.user.id, qName); } catch { }
            // تذكير الاستلام بعد كل مهمة (يتجاهل إذا Quiet Mode)
            if (sendClaimReminder && !getQuietMode(interaction.user.id)) {
                setTimeout(async () => {
                    try {
                        await interaction.user.send({
                            content: [
                                `${EMOJIES.quest} **تذكير الاستلام**`,
                                `خلصت مهمة **${qName}** من 3 دقايق.`,
                                `إذا لسا ما استلمت المكافأة، روح لصفحة **Quests** في ديسكورد واضغط **Claim**.`,
                                `أو استخدم \`/claim\``,
                                `https://discord.com/quests/${qId}`,
                            ].join('\n'),
                        });
                    } catch { }
                }, CLAIM_REMINDER_MS);
            }
        }
        return completed;
    } finally {
        runningTasks.delete(key);
    }
}

// ─── Auto Solve Quest (no Interaction - for scheduled auto mode) ───────────────
// في الـ auto mode البوت ميبعتش DM للـ enroll أو progress
// بيبعت DM بس في حالتين: اكتشاف كويست جديد (في notifier) + اكتمال الكويست (في notifier)
async function autoSolveQuest({ user, token, qId, qName, questConfig, speedMode = 'fast' }) {
    const headers = getHeaders(token);

    // Enroll بدون أي DM
    let enrollResp;
    try {
        enrollResp = await fetch(`https://discord.com/api/v9/quests/${qId}/enroll`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ location: 11 }),
        });
    } catch (err) {
        console.error(`[AutoSolve] Network error during enroll for quest ${qId}: ${err.message}`);
        return false;
    }

    if (![200, 204].includes(enrollResp.status)) {
        const errText = await enrollResp.text().catch(() => '');
        console.error(`[AutoSolve] Enroll failed (${enrollResp.status}) for quest ${qId}: ${errText.slice(0, 120)}`);
        return false;
    }

    // بنعمل dummy dmMessage object بيلوج بس بدل ما يبعت DMs
    const silentMessage = {
        edit: async (payload) => {
            // بنلوج الـ progress في الـ console بس من غير ما نبعت DM
            try {
                const lines = payload?.components?.[0]?.components
                    ?.filter(c => c.type === 10)
                    ?.map(c => c.content)
                    ?.join(' | ') || '';
                console.log(`[AutoSolve] [${qName}] ${lines}`);
            } catch {}
        },
    };

    const key = `${user.id}_${qId}`;
    const ctrl = { cancelled: false };
    runningTasks.set(key, ctrl);

    try {
        const completed = await runQuest({ dmMessage: silentMessage, headers, qId, qName, questConfig, speedMode, ctrl });
        if (completed) {
            try { incrementQuestStats(user.id, qName); } catch { }
            if (!getQuietMode(user.id)) {
                setTimeout(async () => {
                    try {
                        await user.send({
                            content: [
                                `${EMOJIES.quest} **تذكير الاستلام**`,
                                `خلصت مهمة **${qName}** من 3 دقايق.`,
                                `إذا لسا ما استلمت، روح لصفحة Quests واضغط Claim.`,
                                `https://discord.com/quests/${qId}`,
                            ].join('\n'),
                        });
                    } catch { }
                }, CLAIM_REMINDER_MS);
            }
        }
        return completed;
    } finally {
        runningTasks.delete(key);
    }
}

module.exports = {
    solveQuest,
    autoSolveQuest,
    stopQuestTask,
    detectTaskName,
};
