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
    getProxy, setProxy, deleteProxy, listProxies, getActiveRegion, setActiveRegion,
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
        // http:// or https://
        return new HttpsProxyAgent(url);
    } catch (err) {
        console.error(`[Proxy] Failed to create agent: ${err.message}`);
        return null;
    }
}

/**
 * Returns { agent, region, proxyUrl } for the currently active region.
 * region = NONE → no agent (direct connection).
 */
function getActiveProxyAgent() {
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

/**
 * Helper for node-fetch options. Merges agent if a proxy is active.
 */
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
    const rows = listProxies();
    return rows.map(r => ({
        code: r.region,
        name: REGION_NAMES[r.region] || r.region,
        hasProxy: !!r.proxy_url,
    }));
}

module.exports = {
    REGION_NAMES,
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
};
