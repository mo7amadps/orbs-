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
const { incrementQuestStats, getQuietMode, getLanguage } = require('../database/db');
const { t } = require('../utils/i18n');

const CLAIM_REMINDER_MS = 3 * 60 * 1000; // 3 دقائق

// Map: `${userId}_${qId}` => { cancelled: bool }
const runningTasks = new Map();

/** Accent colors by quest task type (Discord integer color) */
const TASK_COLORS = {
    WATCH_VIDEO: 0x57F287,           // green
    WATCH_VIDEO_ON_MOBILE: 0x57F287,
    PLAY_ON_DESKTOP: 0x5865F2,       // blurple
    PLAY_ACTIVITY: 0xEB459E,         // fuchsia
    DEFAULT: 0xFEE75C,               // yellow
};

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

function formatEta(secondsLeft) {
    if (secondsLeft == null || secondsLeft < 0) return null;
    const s = Math.ceil(secondsLeft);
    if (s < 60) return `~${s}s`;
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return rem > 0 ? `~${m}m ${rem}s` : `~${m}m`;
}

// ─── Build Components v2 progress message ─────────────────────────────────────
function buildProgressComponents(title, lines, opts = {}) {
    const last10 = lines.slice(-10).join('\n');
    const parts = [];
    if (typeof opts.percent === 'number') {
        let bar = `\`${progressBar(opts.percent)}\``;
        if (opts.eta) bar += `  ⏱ ${opts.eta}`;
        parts.push(bar);
    }
    parts.push('```ruby', last10 || '...', '```');
    const body = parts.join('\n');

    const accent = opts.color != null ? opts.color : TASK_COLORS.DEFAULT;
    const container = {
        type: 17, // Container
        accent_color: accent,
        components: [
            { type: 10, content: `### ${title}` },
            { type: 14, divider: true, spacing: 1 },
            { type: 10, content: body },
        ],
    };

    const components = [container];

    // On completion: use classic message + link button (more reliable than mixing V2 + link)
    if (opts.claimUrl) {
        return {
            content: `### ${title}\n${body}\n\n${opts.claimUrl}`,
            components: [
                {
                    type: 1,
                    components: [
                        {
                            type: 2,
                            style: 5, // Link
                            label: opts.claimLabel || 'Claim Reward',
                            url: opts.claimUrl,
                            emoji: { name: '🎁' },
                        },
                    ],
                },
            ],
        };
    }

    return {
        flags: 1 << 15, // IS_COMPONENTS_V2
        components,
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

function claimOpts(qId, lang, color) {
    return {
        percent: 100,
        color: color || TASK_COLORS.DEFAULT,
        claimUrl: `https://discord.com/quests/${qId}`,
        claimLabel: t(lang, 'claim_btn') || 'Claim Reward',
    };
}

// ─── Video Quest ───────────────────────────────────────────────────────────────
async function handleVideoQuest({ dmMessage, headers, qId, qName, secondsNeeded, ctrl, lang = 'en', quiet = false }) {
    const startTime = Date.now();
    let secondsDone = 0;
    const progressLines = [];
    let completed = false;
    const interval = 15000;
    const color = TASK_COLORS.WATCH_VIDEO;

    if (!quiet) {
        await dmMessage.edit(buildProgressComponents(qName, [t(lang, 'quest_starting') || 'Starting...'], { color }));
    }

    while (!completed && secondsDone < secondsNeeded) {
        if (ctrl.cancelled) {
            await dmMessage.edit(buildProgressComponents(t(lang, 'quest_stopped') || 'Quest Stopped', [t(lang, 'quest_stopped_by_user') || 'Stopped by user.'], { color }));
            return false;
        }
        await sleep(interval);
        if (ctrl.cancelled) {
            await dmMessage.edit(buildProgressComponents(t(lang, 'quest_stopped') || 'Quest Stopped', [t(lang, 'quest_stopped_by_user') || 'Stopped by user.'], { color }));
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
            await dmMessage.edit(buildProgressComponents(t(lang, 'quest_error') || 'Quest Error', progressLines, { color }));
            return false;
        }

        if (resp.status !== 200) {
            const errText = await resp.text();
            progressLines.push(`[ERROR] API returned ${resp.status}: ${errText.slice(0, 100)}`);
            await dmMessage.edit(buildProgressComponents(t(lang, 'quest_error') || 'Quest Error', progressLines, { color }));
            return false;
        }

        const data = await resp.json();
        completed = data.completed_at != null;
        secondsDone = timestamp;

        const percent = Math.floor((secondsDone / secondsNeeded) * 100);
        const eta = formatEta(secondsNeeded - secondsDone);
        progressLines.push(`[PROGRESS] ${Math.floor(secondsDone)}/${secondsNeeded}s`);
        if (progressLines.length > 8) progressLines.splice(0, progressLines.length - 8);

        if (!quiet || completed) {
            await dmMessage.edit(
                buildProgressComponents(
                    completed ? (t(lang, 'quest_completed_title') || 'Quest Completed!') : qName,
                    progressLines,
                    { percent, eta, color }
                )
            );
        }
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
    progressLines.push(t(lang, 'quest_done_claim') || '✅ Done — claim your reward');
    await dmMessage.edit(buildProgressComponents(
        t(lang, 'quest_completed_title') || 'Quest Completed!',
        progressLines,
        claimOpts(qId, lang, color)
    ));
    return true;
}

// ─── Play Quest ────────────────────────────────────────────────────────────────
async function handlePlayQuest({ dmMessage, headers, qId, qName, secondsNeeded, questConfig, speedMode = 'normal', ctrl, lang = 'en', quiet = false }) {
    const appId = questConfig?.application?.id;
    const color = TASK_COLORS.PLAY_ON_DESKTOP;
    if (!appId) {
        await dmMessage.edit(buildProgressComponents(qName, [`${EMOJIES.error} Application ID missing`], { color }));
        return false;
    }

    const interval = speedMode === 'fast' ? 30000 : 60000;
    let secondsDone = 0;
    const progressLines = [];
    let uiCounter = 0;
    const uiThrottle = speedMode === 'fast' ? 2 : 1;

    if (!quiet) {
        await dmMessage.edit(buildProgressComponents(qName, [t(lang, 'quest_starting') || 'Starting...'], { color }));
    }

    while (secondsDone < secondsNeeded) {
        if (ctrl.cancelled) {
            try {
                await fetch(`https://discord.com/api/v9/quests/${qId}/heartbeat`, {
                    method: 'POST', headers,
                    body: JSON.stringify({ application_id: appId, terminal: true }),
                });
            } catch { }
            await dmMessage.edit(buildProgressComponents(t(lang, 'quest_stopped') || 'Quest Stopped', [t(lang, 'quest_stopped_by_user') || 'Stopped by user.'], { color }));
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
            await dmMessage.edit(buildProgressComponents(t(lang, 'quest_error') || 'Quest Error', progressLines, { color }));
            return false;
        }

        if (resp.status !== 200) {
            progressLines.push(`[ERROR] heartbeat ${resp.status}`);
            await dmMessage.edit(buildProgressComponents(t(lang, 'quest_error') || 'Quest Error', progressLines, { color }));
            return false;
        }

        const data = await resp.json();
        secondsDone = data?.progress?.PLAY_ON_DESKTOP?.value || 0;
        const percent = Math.floor((secondsDone / secondsNeeded) * 100);
        const eta = formatEta(secondsNeeded - secondsDone);
        uiCounter++;

        if (uiCounter >= uiThrottle || secondsDone >= secondsNeeded) {
            progressLines.push(`[PROGRESS] ${Math.floor(secondsDone)}/${secondsNeeded}s`);
            if (progressLines.length > 8) progressLines.splice(0, progressLines.length - 8);
            if (!quiet || secondsDone >= secondsNeeded) {
                await dmMessage.edit(buildProgressComponents(qName, progressLines, { percent, eta, color }));
            }
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
    progressLines.push(t(lang, 'quest_done_claim') || '✅ Done — claim your reward');
    await dmMessage.edit(buildProgressComponents(
        t(lang, 'quest_completed_title') || 'Quest Completed!',
        progressLines,
        claimOpts(qId, lang, color)
    ));
    return true;
}

// ─── Activity Quest ────────────────────────────────────────────────────────────
async function handleActivityQuest({ dmMessage, headers, qId, qName, secondsNeeded, speedMode = 'normal', ctrl, lang = 'en', quiet = false }) {
    const streamKey = 'call:1:1';
    const interval = speedMode === 'fast' ? 10000 : 20000;
    let secondsDone = 0;
    const progressLines = [];
    let uiCounter = 0;
    const uiThrottle = speedMode === 'fast' ? 2 : 1;
    const color = TASK_COLORS.PLAY_ACTIVITY;

    if (!quiet) {
        await dmMessage.edit(buildProgressComponents(qName, [t(lang, 'quest_starting') || 'Starting...'], { color }));
    }

    while (secondsDone < secondsNeeded) {
        if (ctrl.cancelled) {
            try {
                await fetch(`https://discord.com/api/v9/quests/${qId}/heartbeat`, {
                    method: 'POST', headers,
                    body: JSON.stringify({ stream_key: streamKey, terminal: true }),
                });
            } catch { }
            await dmMessage.edit(buildProgressComponents(t(lang, 'quest_stopped') || 'Quest Stopped', [t(lang, 'quest_stopped_by_user') || 'Stopped by user.'], { color }));
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
            await dmMessage.edit(buildProgressComponents(t(lang, 'quest_error') || 'Quest Error', progressLines, { color }));
            return false;
        }

        if (resp.status !== 200) {
            progressLines.push(`[ERROR] heartbeat ${resp.status}`);
            await dmMessage.edit(buildProgressComponents(t(lang, 'quest_error') || 'Quest Error', progressLines, { color }));
            return false;
        }

        const data = await resp.json();
        secondsDone = data?.progress?.PLAY_ACTIVITY?.value || 0;
        const percent = Math.floor((secondsDone / secondsNeeded) * 100);
        const eta = formatEta(secondsNeeded - secondsDone);
        uiCounter++;

        if (uiCounter >= uiThrottle || secondsDone >= secondsNeeded) {
            progressLines.push(`[PROGRESS] ${Math.floor(secondsDone)}/${secondsNeeded}s`);
            if (progressLines.length > 8) progressLines.splice(0, progressLines.length - 8);
            if (!quiet || secondsDone >= secondsNeeded) {
                await dmMessage.edit(buildProgressComponents(qName, progressLines, { percent, eta, color }));
            }
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
    progressLines.push(t(lang, 'quest_done_claim') || '✅ Done — claim your reward');
    await dmMessage.edit(buildProgressComponents(
        t(lang, 'quest_completed_title') || 'Quest Completed!',
        progressLines,
        claimOpts(qId, lang, color)
    ));
    return true;
}

// ─── Core quest runner ────────────────────────────────────────────────────────
async function runQuest({ dmMessage, headers, qId, qName, questConfig, speedMode, ctrl, lang = 'en', quiet = false }) {
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

    const common = { dmMessage, headers, qId, qName, secondsNeeded, ctrl, lang, quiet };
    if (taskName.startsWith('WATCH')) {
        return handleVideoQuest(common);
    } else if (taskName === 'PLAY_ON_DESKTOP') {
        return handlePlayQuest({ ...common, questConfig, speedMode });
    } else if (taskName === 'PLAY_ACTIVITY') {
        return handleActivityQuest({ ...common, speedMode });
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
    const userId = interaction.user.id;
    const lang = getLanguage(userId) || 'en';
    const quiet = getQuietMode(userId);

    let dmMessage;
    try {
        const dmChannel = await interaction.user.createDM();
        dmMessage = await dmChannel.send(buildProgressComponents(qName, [t(lang, 'quest_enrolling') || 'Enrolling...']));
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

    const key = `${userId}_${qId}`;
    const ctrl = { cancelled: false };
    runningTasks.set(key, ctrl);

    try {
        const completed = await runQuest({ dmMessage, headers, qId, qName, questConfig, speedMode, ctrl, lang, quiet });
        if (completed) {
            try { incrementQuestStats(userId, qName); } catch { }
            // تذكير الاستلام — يتخطى في Quiet Mode
            if (sendClaimReminder && !quiet) {
                setTimeout(async () => {
                    try {
                        await interaction.user.send({
                            content: t(lang, 'claim_reminder', {
                                name: qName,
                                url: `https://discord.com/quests/${qId}`,
                            }),
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
    const lang = getLanguage(user.id) || 'en';
    // VIP Auto: always quiet progress (reminder-only mode)
    const quiet = true;

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

    // Silent progress — log only (reminder-only for VIP auto)
    const silentMessage = {
        edit: async (payload) => {
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
        const completed = await runQuest({
            dmMessage: silentMessage, headers, qId, qName, questConfig, speedMode, ctrl, lang, quiet,
        });
        if (completed) {
            try { incrementQuestStats(user.id, qName); } catch { }
            // Always send one completion DM for auto (unless user quiet_mode)
            if (!getQuietMode(user.id)) {
                setTimeout(async () => {
                    try {
                        await user.send({
                            content: t(lang, 'claim_reminder', {
                                name: qName,
                                url: `https://discord.com/quests/${qId}`,
                            }),
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
