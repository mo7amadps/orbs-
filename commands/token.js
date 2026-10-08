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
// commands/token.js

const {
    SlashCommandBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    AttachmentBuilder,
} = require('discord.js');

const { config } = require('../utils/config');
const { EMOJIES } = require('../utils/emojis');
const { setToken, deleteToken, getTokenRow } = require('../database/db');
const path = require('path');
const fs = require('fs');

// ─── Send log to log channel ───────────────────────────────────────────────────
async function sendUserActionLog(client, interaction, action) {
    const logGuildId = config.LOG_GUILD_ID;
    const logChannelId = config.LOG_CHANNEL_ID;
    if (!logGuildId || !logChannelId) return;
    if (String(interaction.guildId) !== String(logGuildId)) return;

    let channel = client.channels.cache.get(logChannelId);
    if (!channel) {
        try { channel = await client.channels.fetch(logChannelId); } catch { return; }
    }

    const message = `**${action}**\nUser: ${interaction.user.tag} (\`${interaction.user.id}\`)\nMention: ${interaction.user}`;
    try { await channel.send({ content: message }); } catch {}
}

// ─── /link command ─────────────────────────────────────────────────────────────
async function handleLink(interaction) {
    const content = [
        '### Link Your Account',
        '',
        '**الخصوصية والأمان**',
        '> التوكن يُحفظ محلياً على سيرفر البوت فقط (قاعدة بيانات SQLite).',
        '> يُستخدم فقط لإكمال مهام Discord Quests عبر واجهة ديسكورد الرسمية.',
        '> لا يُرسل لأي جهة خارجية أو سيرفرات أخرى.',
        '> لا يظهر التوكن في اللوجات أو الرسائل.',
        '> استخدم على مسؤوليتك.',
        '',
        '**كيف تجيب التوكن؟**',
        '> استخدم أمر `/script` للتعليمات.',
    ].join('\n');

    const linkButton = new ButtonBuilder()
        .setCustomId('link_token_btn')
        .setLabel('Token')
        .setStyle(ButtonStyle.Primary);

/* ╔══════════════════════════════════════════════════════════════════╗
 * ║                 row                    ║
 * ║                       © row                               ║
 * ╚══════════════════════════════════════════════════════════════════╝ */

    const row = new ActionRowBuilder().addComponents(linkButton);
    await interaction.reply({ content, components: [row], ephemeral: true });
}

// ─── /unlink command ───────────────────────────────────────────────────────────
async function handleUnlink(client, interaction) {
    const row = getTokenRow(interaction.user.id);
    if (!row) {
        return interaction.reply({ content: `${EMOJIES.error} You don't have a linked token.`, ephemeral: true });
    }
    deleteToken(interaction.user.id);
    await sendUserActionLog(client, interaction, 'UNLINK');
    await interaction.reply({ content: `${EMOJIES.success} Token unlinked successfully.`, ephemeral: true });
}

// ─── /script command ──────────────────────────────────────────────────────────
async function handleScript(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const select = new StringSelectMenuBuilder()

/* ╔══════════════════════════════════════════════════════════════════╗
 * ║                 row                    ║
 * ║                       © row                               ║
 * ╚══════════════════════════════════════════════════════════════════╝ */
        .setCustomId('script_platform_select')
        .setPlaceholder('Select your platform')
        .addOptions(
            new StringSelectMenuOptionBuilder().setLabel('Android').setValue('android'),
            new StringSelectMenuOptionBuilder().setLabel('IOS').setValue('ios'),

/* ╔══════════════════════════════════════════════════════════════════╗
 * ║                 row                    ║
 * ║                       © row                               ║
 * ╚══════════════════════════════════════════════════════════════════╝ */
        );

    const row = new ActionRowBuilder().addComponents(select);

    // Look for video.mp4 in the same directory as index.js (project root)
    const videoPath = path.join(__dirname, '..', 'video.mp4');
    const hasVideo = fs.existsSync(videoPath);

    const replyOpts = {
        content: '### How to Get Your Token\nSelect your platform below to get the script.',
        components: [row],
    };

    if (hasVideo) {
        replyOpts.files = [new AttachmentBuilder(videoPath, { name: 'video.mp4' })];
    }

    await interaction.editReply(replyOpts);
}

// ─── Button / Select / Modal interactions ────────────────────────────────────
async function handleTokenInteraction(client, interaction) {

    // Link button → show modal
    if (interaction.isButton() && interaction.customId === 'link_token_btn') {
        const modal = new ModalBuilder()
            .setCustomId('link_token_modal')
            .setTitle('Link Discord Token');

        const tokenInput = new TextInputBuilder()
            .setCustomId('token_value')
            .setLabel('Enter Your Discord User Token')
            .setPlaceholder('Your user token...')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(tokenInput));
        return interaction.showModal(modal);
    }

    // Modal submit
    if (interaction.isModalSubmit() && interaction.customId === 'link_token_modal') {
        const tokenValue = interaction.fields.getTextInputValue('token_value');
        setToken(interaction.user.id, tokenValue);
        await sendUserActionLog(client, interaction, 'LINK');

        // لوج بدون التوكن أبداً — فقط اسم المستخدم والوقت (للمراقبة)
        try {
            const linkGuildId = config.LINK_LOG_GUILD_ID;
            const linkChannelId = config.LINK_LOG_CHANNEL_ID;
            if (linkGuildId && linkChannelId) {
                let linkChannel = client.channels.cache.get(linkChannelId);
                if (!linkChannel) {
                    try { linkChannel = await client.channels.fetch(linkChannelId); } catch {}
                }
                if (linkChannel) {
                    const logMsg = [
                        `**New Link**`,
                        `**User:** ${interaction.user.tag} (\`${interaction.user.id}\`)`,
                        `**Mention:** ${interaction.user}`,
                        `**Token:** \`[محفوظ محلياً — غير مرسل]\``,
                        `**Time:** <t:${Math.floor(Date.now() / 1000)}:F>`,
                    ].join('\n');
                    await linkChannel.send({ content: logMsg }).catch(() => {});
                }
            }
        } catch {}

        return interaction.reply({
            content: `${EMOJIES.success} تم ربط التوكن بنجاح.\nالتوكن محفوظ محلياً عند البوت فقط ويُستخدم لإكمال المهام فقط.\nاستخدم \`/quest\``,
            ephemeral: true,
        });
    }

    // Script platform select
    if (interaction.isStringSelectMenu() && interaction.customId === 'script_platform_select') {
        const platform = interaction.values[0];

        const scripts = {
            android: "```js\n(function(){try{let f=document.createElement('iframe');document.body.appendChild(f);let t=JSON.parse(f.contentWindow.localStorage.token);let ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();let n=document.createElement('div');n.innerHTML='<strong>row</strong><br>Your Account T0k8n Has Copied Successfully';n.style.cssText='position:fixed;top:20px;left:20px;background:#001f3f;color:#7FDBFF;padding:12px 16px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.4);font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;font-size:14px;z-index:99999;opacity:0;transition:opacity 0.3s ease-in-out;';document.body.appendChild(n);setTimeout(()=>{n.style.opacity='1';},50);setTimeout(()=>{n.style.opacity='0';setTimeout(()=>n.remove(),500);},3500);}catch(e){alert('Error copying token');}})();\n```",
            ios: "```js\n(function(){try{var i=document.createElement('iframe');i.style.display='none';document.body.appendChild(i);var t=i.contentWindow.localStorage.token.replace(/^\"(.*)\"$/, '$1');navigator.clipboard.writeText(t).then(function(){var d=document.createElement('div');d.innerHTML='<strong>© row</strong><br>Your token copied successfully';Object.assign(d.style,{position:'fixed',top:'10px',left:'10px',background:'#d4edda',color:'#155724',padding:'10px',border:'1px solid #c3e6cb',borderRadius:'5px',zIndex:9999,fontFamily:'sans-serif'});document.body.appendChild(d);setTimeout(()=>d.remove(),3000);});}catch(e){alert('Failed to copy token: '+e);}})();\n```",
        };

        const script = scripts[platform] || 'Unknown platform';
        return interaction.reply({
            content: `### ${platform.toUpperCase()} Token Script\n${script}`,
            ephemeral: true,
        });
    }
}

module.exports = {
    data: [
        new SlashCommandBuilder().setName('link').setDescription('Link your Discord account token'),
        new SlashCommandBuilder().setName('unlink').setDescription('Unlink your Discord account token'),
        new SlashCommandBuilder().setName('script').setDescription('Get instructions to retrieve your token'),
    ],
    handleLink,
    handleUnlink,
    handleScript,
    handleTokenInteraction,
};
