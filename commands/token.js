/*
╔══════════════════════════════════════════════════════════════════════╗
║                              row                              ║
║                     © row — All Rights Reserved              ║
╚══════════════════════════════════════════════════════════════════════╝
*/
const {
    SlashCommandBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    AttachmentBuilder,
} = require('discord.js');
const { EMOJIES } = require('../utils/emojis');
const { getLanguage } = require('../database/db');
const { t } = require('../utils/i18n');
const { requireStarter } = require('../utils/guards');
const path = require('path');
const fs = require('fs');

async function handleScript(client, interaction) {
    // Server + Starter required
    if (await requireStarter(client, interaction)) return;

    await interaction.deferReply({ ephemeral: true });

    const select = new StringSelectMenuBuilder()
        .setCustomId('script_platform_select')
        .setPlaceholder('Select your platform / اختر منصتك')
        .addOptions(
            new StringSelectMenuOptionBuilder().setLabel('Android').setValue('android').setEmoji('📱'),
            new StringSelectMenuOptionBuilder().setLabel('iOS').setValue('ios').setEmoji('🍎'),
            new StringSelectMenuOptionBuilder().setLabel('Desktop (Browser)').setValue('desktop').setEmoji('💻'),
        );

    const row = new ActionRowBuilder().addComponents(select);

    const videoPath = path.join(__dirname, '..', 'video.mp4');
    const hasVideo = fs.existsSync(videoPath);

    const content = [
        '### 🔑 How to Get Your Discord Token',
        '',
        '**الخصوصية:** التوكن يُحفظ محلياً عند البوت فقط ويُستخدم لإكمال المهام.',
        '',
        '1. اختر منصتك من القائمة تحت',
        '2. انسخ السكريبت',
        '3. افتح Discord في المتصفح (أو التطبيق حسب المنصة)',
        '4. الصق السكريبت في Console واضغط Enter',
        '5. التوكن راح ينسخ تلقائياً',
        '',
        '⚠️ **لا تشارك التوكن مع أحد أبداً.**',
    ].join('\n');

    const replyOpts = { content, components: [row] };
    if (hasVideo) {
        replyOpts.files = [new AttachmentBuilder(videoPath, { name: 'how-to-token.mp4' })];
    }

    await interaction.editReply(replyOpts);
}

async function handleTokenInteraction(client, interaction) {
    if (interaction.isStringSelectMenu() && interaction.customId === 'script_platform_select') {
        const platform = interaction.values[0];

        const scripts = {
            android: [
                '```js',
                "(function(){try{let f=document.createElement('iframe');document.body.appendChild(f);let t=JSON.parse(f.contentWindow.localStorage.token);let ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();let n=document.createElement('div');n.innerHTML='<strong>row</strong><br>Token copied!';n.style.cssText='position:fixed;top:20px;left:20px;background:#001f3f;color:#7FDBFF;padding:12px 16px;border-radius:8px;z-index:99999;';document.body.appendChild(n);setTimeout(()=>n.remove(),3500);}catch(e){alert('Error: '+e);}})();",
                '```',
            ].join('\n'),
            ios: [
                '```js',
                "(function(){try{var i=document.createElement('iframe');i.style.display='none';document.body.appendChild(i);var t=i.contentWindow.localStorage.token.replace(/^\"(.*)\"$/,'$1');navigator.clipboard.writeText(t).then(function(){var d=document.createElement('div');d.innerHTML='<strong>row</strong><br>Token copied!';Object.assign(d.style,{position:'fixed',top:'10px',left:'10px',background:'#d4edda',color:'#155724',padding:'10px',borderRadius:'5px',zIndex:9999});document.body.appendChild(d);setTimeout(()=>d.remove(),3000);});}catch(e){alert('Failed: '+e);}})();",
                '```',
            ].join('\n'),
            desktop: [
                '```js',
                "window.webpackChunkdiscord_app.push([[Symbol()],{},o=>{for(let e of Object.values(o.c))try{if(!e.exports||e.exports===window)continue;if(e.exports?.getToken)return void console.log('Token:\\n'+e.exports.getToken());for(let o in e.exports)if(e.exports?.[o]?.getToken&&'IntlMessagesProxy'!==e.exports[o][Symbol.toStringTag])return void console.log('Token:\\n'+e.exports[o].getToken())}catch{}}]),window.webpackChunkdiscord_app.pop();",
                '```',
                '',
                'أو افتح Console (F12) والصق الكود فوق، راح يطبع التوكن في الـ Console.',
            ].join('\n'),
        };

        const script = scripts[platform] || 'Unknown platform';
        return interaction.reply({
            content: `### ${platform.toUpperCase()} Token Script\n\n${script}\n\n✅ بعد ما ينسخ، استخدمه مع \`/quest token:...\` أو \`/vip-quest token:...\``,
            ephemeral: true,
        });
    }
    return false;
}

module.exports = {
    data: [
        new SlashCommandBuilder()
            .setName('script')
            .setDescription('How to get your Discord token / كيف تجيب التوكن')
            .setDMPermission(true),
    ],
    handleScript,
    handleTokenInteraction,
};
