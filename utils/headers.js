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
const { v4: uuidv4 } = require('uuid');
const { Buffer } = require('buffer');

// Updated Nov 2026 — closer to current Discord desktop client
const CLIENT_VERSION = '1.0.9266';
const CHROME_VERSION = '152.0.7977.167';
const ELECTRON_VERSION = '44.9.3';
const CLIENT_BUILD_NUMBER = 657850;
const NATIVE_BUILD_NUMBER = 97026;

const USER_AGENT = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) discord/${CLIENT_VERSION} Chrome/${CHROME_VERSION} Electron/${ELECTRON_VERSION} Safari/537.36`;

function getSuperProperties() {
    return {
        os: 'Windows',
        browser: 'Discord Client',
        release_channel: 'stable',
        client_version: CLIENT_VERSION,
        os_version: '10.0.19045',
        os_arch: 'x64',
        app_arch: 'x64',
        system_locale: 'en-US',
        has_client_mods: false,
        client_launch_id: uuidv4(),
        browser_user_agent: USER_AGENT,
        browser_version: ELECTRON_VERSION,
        os_sdk_version: '19045',
        client_build_number: CLIENT_BUILD_NUMBER,
        native_build_number: NATIVE_BUILD_NUMBER,
        client_event_source: null,
        launch_signature: uuidv4(),
        client_heartbeat_session_id: uuidv4(),
        client_app_state: 'focused',
    };
}

function getHeaders(token) {
    const superProps = Buffer.from(JSON.stringify(getSuperProperties())).toString('base64');
    return {
        Authorization: token,
        Accept: '*/*',
        'Accept-Language': 'en-US',
        'Content-Type': 'application/json',
        'User-Agent': USER_AGENT,
        'X-Super-Properties': superProps,
        'X-Discord-Locale': 'en-US',
        'X-Discord-Timezone': 'Asia/Saigon',
        'X-Debug-Options': 'bugReporterEnabled',
        Origin: 'https://discord.com',
        Referer: 'https://discord.com/channels/@me',
        'Sec-Ch-Ua': `"Not)A;Brand";v="8", "Chromium";v="152"`,
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        Pragma: 'no-cache',
        Priority: 'u=1, i',
    };
}

module.exports = { getHeaders, USER_AGENT };
