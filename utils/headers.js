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
const { v4: uuidv4 } = require('uuid');
const { Buffer } = require('buffer');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) discord/1.0.9215 Chrome/138.0.7204.251 Electron/37.6.0 Safari/537.36';
const CLIENT_BUILD_NUMBER = 471091;

function getSuperProperties() {
    return {
        os: 'Windows',
        browser: 'Discord Client',
        release_channel: 'stable',
        client_version: '1.0.9215',
        os_version: '10.0.19045',
        os_arch: 'x64',
        app_arch: 'x64',

/* ╔══════════════════════════════════════════════════════════════════╗
 * ║                 KSHK STORE / discord.gg/kshk                    ║
 * ║                       © KSHK Store                               ║
 * ╚══════════════════════════════════════════════════════════════════╝ */
        system_locale: 'en-US',

/* ╔══════════════════════════════════════════════════════════════════╗
 * ║                 KSHK STORE / discord.gg/kshk                    ║
 * ║                       © KSHK Store                               ║
 * ╚══════════════════════════════════════════════════════════════════╝ */
        has_client_mods: false,
        client_launch_id: uuidv4(),
        browser_user_agent: USER_AGENT,
        browser_version: '37.6.0',
        os_sdk_version: '19045',
        client_build_number: CLIENT_BUILD_NUMBER,
        native_build_number: 72186,
        client_event_source: null,

/* ╔══════════════════════════════════════════════════════════════════╗
 * ║                 KSHK STORE / discord.gg/kshk                    ║
 * ║                       © KSHK Store                               ║
 * ╚══════════════════════════════════════════════════════════════════╝ */
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

/* ╔══════════════════════════════════════════════════════════════════╗
 * ║                 KSHK STORE / discord.gg/kshk                    ║
 * ║                       © KSHK Store                               ║
 * ╚══════════════════════════════════════════════════════════════════╝ */
        'X-Debug-Options': 'bugReporterEnabled',
        Origin: 'https://discord.com',
        Referer: 'https://discord.com/channels/@me',
        'Sec-Ch-Ua': '"Not)A;Brand";v="8", "Chromium";v="138"',
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
