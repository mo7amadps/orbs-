/*
╔══════════════════════════════════════════════════════════════════════╗
║                              row                              ║
║                     © row — All Rights Reserved              ║
╚══════════════════════════════════════════════════════════════════════╝
*/
const fetch = require('node-fetch');

const COUNTRY_META = {
    US: { flag: '🇺🇸', name: 'United States' },
    CA: { flag: '🇨🇦', name: 'Canada' },
    UK: { flag: '🇬🇧', name: 'United Kingdom' },
    GB: { flag: '🇬🇧', name: 'United Kingdom' },
    AU: { flag: '🇦🇺', name: 'Australia' },
    NZ: { flag: '🇳🇿', name: 'New Zealand' },
    DE: { flag: '🇩🇪', name: 'Germany' },
    FR: { flag: '🇫🇷', name: 'France' },
    ES: { flag: '🇪🇸', name: 'Spain' },
    IT: { flag: '🇮🇹', name: 'Italy' },
    PL: { flag: '🇵🇱', name: 'Poland' },
    BR: { flag: '🇧🇷', name: 'Brazil' },
    MX: { flag: '🇲🇽', name: 'Mexico' },
    JP: { flag: '🇯🇵', name: 'Japan' },
    KR: { flag: '🇰🇷', name: 'South Korea' },
    PH: { flag: '🇵🇭', name: 'Philippines' },
    ID: { flag: '🇮🇩', name: 'Indonesia' },
    IN: { flag: '🇮🇳', name: 'India' },
    TW: { flag: '🇹🇼', name: 'Taiwan' },
    HK: { flag: '🇭🇰', name: 'Hong Kong' },
    SA: { flag: '🇸🇦', name: 'Saudi Arabia' },
    AE: { flag: '🇦🇪', name: 'UAE' },
    FI: { flag: '🇫🇮', name: 'Finland' },
    BE: { flag: '🇧🇪', name: 'Belgium' },
    NL: { flag: '🇳🇱', name: 'Netherlands' },
    SE: { flag: '🇸🇪', name: 'Sweden' },
    NO: { flag: '🇳🇴', name: 'Norway' },
    DK: { flag: '🇩🇰', name: 'Denmark' },
    TR: { flag: '🇹🇷', name: 'Turkey' },
    RU: { flag: '🇷🇺', name: 'Russia' },
    AR: { flag: '🇦🇷', name: 'Argentina' },
    CL: { flag: '🇨🇱', name: 'Chile' },
    CO: { flag: '🇨🇴', name: 'Colombia' },
    SG: { flag: '🇸🇬', name: 'Singapore' },
    MY: { flag: '🇲🇾', name: 'Malaysia' },
    TH: { flag: '🇹🇭', name: 'Thailand' },
    VN: { flag: '🇻🇳', name: 'Vietnam' },
    PT: { flag: '🇵🇹', name: 'Portugal' },
    IE: { flag: '🇮🇪', name: 'Ireland' },
    CH: { flag: '🇨🇭', name: 'Switzerland' },
    AT: { flag: '🇦🇹', name: 'Austria' },
    CZ: { flag: '🇨🇿', name: 'Czechia' },
    RO: { flag: '🇷🇴', name: 'Romania' },
    UA: { flag: '🇺🇦', name: 'Ukraine' },
    EG: { flag: '🇪🇬', name: 'Egypt' },
    ZA: { flag: '🇿🇦', name: 'South Africa' },
};

function countryLabel(code) {
    const c = String(code || '').toUpperCase();
    const meta = COUNTRY_META[c];
    if (meta) return `${meta.flag} ${meta.name}`;
    return `🏳️ ${c}`;
}

function countryFlag(code) {
    const c = String(code || '').toUpperCase();
    return (COUNTRY_META[c] && COUNTRY_META[c].flag) || '🏳️';
}

let regionCache = { at: 0, byId: new Map(), list: [] };
const CACHE_MS = 10 * 60 * 1000;

async function fetchRegionMap(force = false) {
    if (!force && regionCache.at && Date.now() - regionCache.at < CACHE_MS && regionCache.byId.size) {
        return regionCache;
    }
    try {
        const resp = await fetch('https://api.discordquest.com/api/regions', {
            headers: { 'User-Agent': 'QuestBot/1.0' },
            timeout: 15000,
        });
        if (!resp.ok) throw new Error(`regions HTTP ${resp.status}`);
        const data = await resp.json();
        const list = data.quests || data || [];
        const byId = new Map();
        for (const row of list) {
            if (!row || !row.id) continue;
            byId.set(String(row.id), {
                id: String(row.id),
                isGlobal: !!row.is_global,
                showAgeGate: !!row.show_age_gate,
                include: (row.regions && row.regions.include) || [],
                exclude: (row.regions && row.regions.exclude) || [],
                replacementId: row.replacement_id || null,
            });
        }
        regionCache = { at: Date.now(), byId, list: [...byId.values()] };
        return regionCache;
    } catch (err) {
        console.error('[Regions] fetch failed:', err.message);
        return regionCache.byId.size ? regionCache : { at: 0, byId: new Map(), list: [] };
    }
}

function getQuestRegionInfo(questId) {
    if (!questId) return null;
    return regionCache.byId.get(String(questId)) || null;
}

/** Human-readable region lines for embeds */
function formatRegions(regionInfo) {
    if (!regionInfo) return null;
    if (regionInfo.isGlobal && !(regionInfo.include && regionInfo.include.length) && !(regionInfo.exclude && regionInfo.exclude.length)) {
        return { isGlobal: true, text: '🌍 Global', lines: ['🌍 Global'] };
    }
    const lines = [];
    if (regionInfo.include && regionInfo.include.length) {
        for (const code of regionInfo.include) lines.push(countryLabel(code));
    }
    if (regionInfo.exclude && regionInfo.exclude.length) {
        lines.push('⛔ Exclude: ' + regionInfo.exclude.map(c => countryFlag(c) + c).join(' '));
    }
    if (!lines.length) return { isGlobal: true, text: '🌍 Global', lines: ['🌍 Global'] };
    return {
        isGlobal: false,
        text: lines.join('\n'),
        lines,
        include: regionInfo.include || [],
        exclude: regionInfo.exclude || [],
    };
}

/** Group active non-global quests by country code */
function groupExclusiveByCountry(regionList, activeQuestIds) {
    const active = activeQuestIds ? new Set([...activeQuestIds].map(String)) : null;
    const map = new Map(); // code -> count
    for (const r of regionList) {
        if (active && !active.has(String(r.id))) continue;
        if (r.isGlobal && !(r.include && r.include.length)) continue;
        const codes = (r.include && r.include.length) ? r.include : [];
        for (const code of codes) {
            const c = String(code).toUpperCase();
            map.set(c, (map.get(c) || 0) + 1);
        }
    }
    return [...map.entries()]
        .map(([code, count]) => ({ code, count, label: countryLabel(code), flag: countryFlag(code) }))
        .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));
}

async function fetchPublicQuests() {
    try {
        const resp = await fetch('https://api.discordquest.com/api/quests', {
            headers: { 'User-Agent': 'QuestBot/1.0' },
            timeout: 20000,
        });
        if (!resp.ok) throw new Error(`quests HTTP ${resp.status}`);
        const data = await resp.json();
        // API may return array or { quests: [] }
        const list = Array.isArray(data) ? data : (data.quests || []);
        return list;
    } catch (err) {
        console.error('[Regions] public quests fetch failed:', err.message);
        return [];
    }
}

/** Active = not expired */
function isQuestActive(quest) {
    const cfg = quest.config || quest;
    const expiresAt = cfg.expires_at || cfg.expiresAt;
    if (!expiresAt) return true;
    try {
        return new Date() <= new Date(expiresAt);
    } catch {
        return true;
    }
}

module.exports = {
    COUNTRY_META,
    countryLabel,
    countryFlag,
    fetchRegionMap,
    getQuestRegionInfo,
    formatRegions,
    groupExclusiveByCountry,
    fetchPublicQuests,
    isQuestActive,
};
