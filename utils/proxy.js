/*
╔══════════════════════════════════════════════════════════════════════╗
║                              row                              ║
║                     © row — All Rights Reserved              ║
╚══════════════════════════════════════════════════════════════════════╝
*/
const { HttpsProxyAgent } = require('https-proxy-agent');
const { SocksProxyAgent } = require('socks-proxy-agent');
const {
    getSetting, setSetting,
    getProxy: dbGetProxy, setProxy: dbSetProxy, deleteProxy: dbDeleteProxy,
    listProxies: dbListProxies, getActiveRegion, setActiveRegion,
} = require('../database/db');

const REGION_NAMES = {
    US: 'United States 🇺🇸',
    GB: 'United Kingdom 🇬🇧',
    DE: 'Germany 🇩🇪',
    FR: 'France 🇫🇷',
    NL: 'Netherlands 🇳🇱',
    CA: 'Canada 🇨🇦',
    AU: 'Australia 🇦🇺',
    JP: 'Japan 🇯🇵',
    KR: 'South Korea 🇰🇷',
    SG: 'Singapore 🇸🇬',
    BR: 'Brazil 🇧🇷',
    IN: 'India 🇮🇳',
    TR: 'Turkey 🇹🇷',
    PL: 'Poland 🇵🇱',
    SE: 'Sweden 🇸🇪',
    IT: 'Italy 🇮🇹',
    ES: 'Spain 🇪🇸',
    AE: 'UAE 🇦🇪',
    SA: 'Saudi Arabia 🇸🇦',
    EG: 'Egypt 🇪🇬',
    PS: 'Palestine 🇵🇸',
    JO: 'Jordan 🇯🇴',
    IQ: 'Iraq 🇮🇶',
    NONE: 'Direct (No Proxy)',
};

// Built-in proxies (Webshare free) — no /proxy command needed
const BUILTIN_PROXIES = {
    US: 'http://wmnfqsol:8viltay75c75@198.23.243.226:6361',
    GB: 'http://wmnfqsol:8viltay75c75@45.38.107.97:6014',
    DE: 'http://wmnfqsol:8viltay75c75@64.137.10.153:5803',
    ES: 'http://wmnfqsol:8viltay75c75@64.137.96.74:6641',
    PL: 'http://wmnfqsol:8viltay75c75@84.247.60.125:6095',
};

// Extra US backups (rotated if primary fails later)
const US_BACKUPS = [
    'http://wmnfqsol:8viltay75c75@191.96.254.138:6185',
    'http://wmnfqsol:8viltay75c75@198.46.161.42:5092',
    'http://wmnfqsol:8viltay75c75@38.154.185.97:6370',
    'http://wmnfqsol:8viltay75c75@104.164.49.38:7693',
    'http://wmnfqsol:8viltay75c75@23.26.71.145:5628',
];

let seeded = false;

function seedBuiltinProxies() {
    if (seeded) return;
    seeded = true;
    try {
        for (const [region, url] of Object.entries(BUILTIN_PROXIES)) {
            const existing = dbGetProxy(region);
            if (!existing || !existing.proxy_url) {
                dbSetProxy(region, url, 'builtin');
                console.log(`[Proxy] Seeded ${region}`);
            }
        }
        // Default active region → US if nothing set
        const active = getActiveRegion();
        if (!active || active === 'NONE') {
            setActiveRegion('US');
            console.log('[Proxy] Default active region → US');
        }
    } catch (err) {
        console.error('[Proxy] Seed failed:', err.message);
    }
}

function normalizeRegion(code) {
    if (!code) return null;
    const c = String(code).trim().toUpperCase();
    if (c === 'NONE' || c === 'OFF' || c === 'DIRECT') return 'NONE';
    return c;
}

function buildAgent(proxyUrl) {
    if (!proxyUrl) return null;
    const url = String(proxyUrl).trim();
    if (!url) return null;

    try {
        if (url.startsWith('socks5://') || url.startsWith('socks4://') || url.startsWith('socks://')) {
            return new SocksProxyAgent(url);
        }
        return new HttpsProxyAgent(url);
    } catch (err) {
        console.error(`[Proxy] Failed to create agent: ${err.message}`);
        return null;
    }
}

function getProxy(region) {
    seedBuiltinProxies();
    const code = String(region).toUpperCase();
    const row = dbGetProxy(code);
    if (row && row.proxy_url) return row;
    if (BUILTIN_PROXIES[code]) {
        return { region: code, proxy_url: BUILTIN_PROXIES[code], label: 'builtin' };
    }
    return null;
}

function setProxy(region, proxyUrl, label = null) {
    return dbSetProxy(region, proxyUrl, label);
}

function deleteProxy(region) {
    return dbDeleteProxy(region);
}

function listProxies() {
    seedBuiltinProxies();
    const fromDb = dbListProxies();
    const map = new Map();
    for (const r of fromDb) map.set(r.region, r);
    for (const [region, url] of Object.entries(BUILTIN_PROXIES)) {
        if (!map.has(region)) {
            map.set(region, { region, proxy_url: url, label: 'builtin' });
        }
    }
    return Array.from(map.values()).sort((a, b) => a.region.localeCompare(b.region));
}

function getActiveProxyAgent() {
    seedBuiltinProxies();
    const region = getActiveRegion() || 'NONE';
    if (region === 'NONE') {
        return { agent: null, region: 'NONE', proxyUrl: null };
    }

    const row = getProxy(region);
    if (!row || !row.proxy_url) {
        return { agent: null, region, proxyUrl: null, missing: true };
    }

    const agent = buildAgent(row.proxy_url);
    return { agent, region, proxyUrl: row.proxy_url, missing: !agent };
}

function withProxy(fetchOptions = {}) {
    const { agent, region, missing } = getActiveProxyAgent();
    if (missing) {
        console.warn(`[Proxy] Active region ${region} has no valid proxy — using direct`);
    }
    if (agent) {
        return { ...fetchOptions, agent };
    }
    return fetchOptions;
}

function listAvailableRegions() {
    return listProxies().map(r => ({
        code: r.region,
        name: REGION_NAMES[r.region] || r.region,
        hasProxy: !!r.proxy_url,
    }));
}

module.exports = {
    REGION_NAMES,
    BUILTIN_PROXIES,
    US_BACKUPS,
    normalizeRegion,
    buildAgent,
    getActiveProxyAgent,
    withProxy,
    listAvailableRegions,
    getActiveRegion,
    setActiveRegion,
    getProxy,
    setProxy,
    deleteProxy,
    listProxies,
    seedBuiltinProxies,
};
