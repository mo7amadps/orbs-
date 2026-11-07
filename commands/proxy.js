/*
╔══════════════════════════════════════════════════════════════════════╗
║                              row                              ║
║                     © row — All Rights Reserved              ║
╚══════════════════════════════════════════════════════════════════════╝
*/
const { SlashCommandBuilder } = require('discord.js');
const { isOwner } = require('../utils/guards');
const {
    REGION_NAMES,
    normalizeRegion,
    getActiveRegion,
    setActiveRegion,
    getProxy,
    setProxy,
    deleteProxy,
    listProxies,
    getActiveProxyAgent,
} = require('../utils/proxy');

async function handleProxyCommand(client, interaction) {
    if (!isOwner(interaction.user.id)) {
        return interaction.reply({
            content: '❌ Owner only.\nUse the **VPN / Regions** button inside `/quest` or `/vip-quest` to select a country.',
            ephemeral: true,
        });
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'add') {
        const region = normalizeRegion(interaction.options.getString('region'));
        const url = interaction.options.getString('url').trim();
        const label = interaction.options.getString('label') || null;

        if (!region || region === 'NONE') {
            return interaction.reply({ content: '❌ Invalid region code (e.g. US, GB, DE).', ephemeral: true });
        }
        if (!url.match(/^(https?|socks[45]?):\/\//i)) {
            return interaction.reply({
                content: '❌ URL must start with `http://`, `https://`, `socks5://` or `socks4://`',
                ephemeral: true,
            });
        }

        setProxy(region, url, label);
        const name = REGION_NAMES[region] || region;
        return interaction.reply({
            content: `✅ Proxy saved for **${name}** (\`${region}\`)\n\`${url.replace(/:[^:@]+@/, ':****@')}\`\n\nUsers pick it via **VPN / Regions** button.`,
            ephemeral: true,
        });
    }

    if (sub === 'remove') {
        const region = normalizeRegion(interaction.options.getString('region'));
        if (!region || region === 'NONE') {
            return interaction.reply({ content: '❌ Invalid region.', ephemeral: true });
        }
        deleteProxy(region);
        if (getActiveRegion() === region) setActiveRegion('NONE');
        return interaction.reply({ content: `✅ Removed proxy for \`${region}\``, ephemeral: true });
    }

    if (sub === 'status') {
        const active = getActiveRegion();
        const { agent, missing } = getActiveProxyAgent();
        const rows = listProxies();

        const lines = [
            `**Active region:** \`${active}\` ${REGION_NAMES[active] || ''}`,
            `**Agent:** ${agent ? '✅ OK' : (missing ? '⚠️ Missing' : 'Direct')}`,
            '',
            '**Configured:**',
        ];

        if (!rows.length) {
            lines.push('_None. `/proxy add region:US url:http://...`_');
        } else {
            for (const r of rows) {
                const mark = r.region === active ? '→ ' : '  ';
                const name = REGION_NAMES[r.region] || r.region;
                const safe = (r.proxy_url || '').replace(/:[^:@]+@/, ':****@');
                lines.push(`${mark}\`${r.region}\` ${name} — \`${safe}\``);
            }
        }

        return interaction.reply({ content: lines.join('\n'), ephemeral: true });
    }

    return interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
}

async function handleProxySelect() {
    return false;
}

const data = [
    new SlashCommandBuilder()
        .setName('proxy')
        .setDescription('Owner: manage region proxies')
        .addSubcommand(sc =>
            sc.setName('add')
                .setDescription('Add/update proxy for a region')
                .addStringOption(o =>
                    o.setName('region').setDescription('US / GB / DE / ...').setRequired(true),
                )
                .addStringOption(o =>
                    o.setName('url').setDescription('http://user:pass@ip:port or socks5://...').setRequired(true),
                )
                .addStringOption(o =>
                    o.setName('label').setDescription('Optional note').setRequired(false),
                ),
        )
        .addSubcommand(sc =>
            sc.setName('remove')
                .setDescription('Remove proxy for a region')
                .addStringOption(o =>
                    o.setName('region').setDescription('US / GB / DE').setRequired(true),
                ),
        )
        .addSubcommand(sc =>
            sc.setName('status')
                .setDescription('Show configured proxies & active region'),
        ),
];

module.exports = {
    data,
    handleProxyCommand,
    handleProxySelect,
};
