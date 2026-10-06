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
// handler.js - Quest execution engine

const fetch = require('node-fetch');
const { getHeaders } = require('../utils/headers');
const { EMOJIES } = require('../utils/emojis');

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

// ─── Build Components v2 progress message ─────────────────────────────────────
function buildProgressComponents(title, lines) {
    const last10 = lines.slice(-10).join('\n');
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
                        content: `\`\`\`ruby\n${last10 || '...'}\n\`\`\``,
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

// ─── Video Quest ───────────────────────────────────────────────────────────────
async function handleVideoQuest({ dmMessage, headers, qId, qName, secondsNeeded, ctrl }) {
    const startTime = Date.now();
    let secondsDone = 0;

/* ╔══════════════════════════════════════════════════════════════════╗
 * ║                 KSHK STORE / discord.gg/kshk                    ║
 * ║                       © KSHK Store                               ║
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
            resp = await fetch(`https://discord.com/api/v9/quests/${qId}/video-progress`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ timestamp }),
            });
        } catch (err) {
            progressLines.push(`[ERROR] Network error: ${err.message.slice(0, 80)}`);
            await dmMessage.edit(buildProgressComponents('Quest Error', progressLines));

/* ╔══════════════════════════════════════════════════════════════════╗
 * ║                 KSHK STORE / discord.gg/kshk                    ║
 * ║                       © KSHK Store                               ║
 * ╚══════════════════════════════════════════════════════════════════╝ */
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


/* ╔══════════════════════════════════════════════════════════════════╗
 * ║                 KSHK STORE / discord.gg/kshk                    ║
 * ║                       © KSHK Store                               ║
 * ╚══════════════════════════════════════════════════════════════════╝ */
        const percent = Math.floor((secondsDone / secondsNeeded) * 100);
        progressLines.push(`[PROGRESS] ${percent}% (${Math.floor(secondsDone)}/${secondsNeeded}s)`);
        if (progressLines.length > 8) progressLines.splice(0, progressLines.length - 8);

        await dmMessage.edit(
            buildProgressComponents(completed ? 'Quest Completed!' : qName, progressLines)
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

    if (!progressLines.length || !progressLines[progressLines.length - 1].startsWith('[PROGRESS] 100%')) {
        progressLines.push('[PROGRESS] 100%');
    }

    await dmMessage.edit(buildProgressComponents('Quest Completed!', progressLines));

/* ╔══════════════════════════════════════════════════════════════════╗
 * ║                 KSHK STORE / discord.gg/kshk                    ║
 * ║                       © KSHK Store                               ║
 * ╚══════════════════════════════════════════════════════════════════╝ */
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
            resp = await fetch(`https://discord.com/api/v9/quests/${qId}/heartbeat`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ application_id: appId, terminal: false }),
            });
        } catch (err) {
            console.error(`[Handler] heartbeat fetch error: ${err.message}`);
            return false;
        }

        if (resp.status !== 200) return false;

        const data = await resp.json();
        secondsDone = data?.progress?.PLAY_ON_DESKTOP?.value || 0;
        const percent = Math.floor((secondsDone / secondsNeeded) * 100);
        uiCounter++;

        if (uiCounter >= uiThrottle || secondsDone >= secondsNeeded) {
            progressLines.push(`[PROGRESS] ${percent}%`);
            await dmMessage.edit(buildProgressComponents(qName, progressLines));
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

    if (!progressLines.length || progressLines[progressLines.length - 1] !== '[PROGRESS] 100%') {
        progressLines.push('[PROGRESS] 100%');
    }
    await dmMessage.edit(buildProgressComponents('Quest Completed!', progressLines));
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
            resp = await fetch(`https://discord.com/api/v9/quests/${qId}/heartbeat`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ stream_key: streamKey, terminal: false }),
            });
        } catch (err) {
            console.error(`[Handler] heartbeat fetch error: ${err.message}`);
            return false;
        }

        if (resp.status !== 200) return false;

        const data = await resp.json();
        secondsDone = data?.progress?.PLAY_ACTIVITY?.value || 0;
        const percent = Math.floor((secondsDone / secondsNeeded) * 100);
        uiCounter++;

        if (uiCounter >= uiThrottle || secondsDone >= secondsNeeded) {
            progressLines.push(`[PROGRESS] ${percent}%`);
            await dmMessage.edit(buildProgressComponents(qName, progressLines));
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

/* ╔══════════════════════════════════════════════════════════════════╗
 * ║                 KSHK STORE / discord.gg/kshk                    ║
 * ║                       © KSHK Store                               ║
 * ╚══════════════════════════════════════════════════════════════════╝ */

    if (!progressLines.length || progressLines[progressLines.length - 1] !== '[PROGRESS] 100%') {
        progressLines.push('[PROGRESS] 100%');
    }
    await dmMessage.edit(buildProgressComponents('Quest Completed!', progressLines));
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
async function solveQuest({ interaction, token, qId, qName, questConfig, speedMode = 'normal' }) {
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
        return await runQuest({ dmMessage, headers, qId, qName, questConfig, speedMode, ctrl });
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
        return await runQuest({ dmMessage: silentMessage, headers, qId, qName, questConfig, speedMode, ctrl });
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
