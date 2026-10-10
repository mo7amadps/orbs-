/*
╔══════════════════════════════════════════════════════════════════════╗
║                              row                              ║
║                     © row — All Rights Reserved              ║
╚══════════════════════════════════════════════════════════════════════╝
*/
// Full multi-language support

const LANGUAGES = {
    ar: { name: 'العربية', flag: '🇸🇦' },
    en: { name: 'English', flag: '🇺🇸' },
    fr: { name: 'Français', flag: '🇫🇷' },
    ru: { name: 'Русский', flag: '🇷🇺' },
    es: { name: 'Español', flag: '🇪🇸' },
    de: { name: 'Deutsch', flag: '🇩🇪' },
    zh: { name: '中文', flag: '🇨🇳' },
    hi: { name: 'हिन्दी', flag: '🇮🇳' },
};

const STRINGS = {
    // ── Common ──
    error: {
        ar: '❌ حدث خطأ',
        en: '❌ An error occurred',
        fr: '❌ Une erreur est survenue',
        ru: '❌ Произошла ошибка',
        es: '❌ Ocurrió un error',
        de: '❌ Ein Fehler ist aufgetreten',
        zh: '❌ 发生错误',
        hi: '❌ एक त्रुटि हुई',
    },
    success: {
        ar: '✅ تم بنجاح',
        en: '✅ Success',
        fr: '✅ Succès',
        ru: '✅ Успешно',
        es: '✅ Éxito',
        de: '✅ Erfolg',
        zh: '✅ 成功',
        hi: '✅ सफल',
    },
    must_join_server: {
        ar: 'يجب أن تدخل السيرفر أولاً:\n{invite}',
        en: 'You must join the server first:\n{invite}',
        fr: 'Vous devez d\'abord rejoindre le serveur :\n{invite}',
        ru: 'Сначала нужно зайти на сервер:\n{invite}',
        es: 'Debes unirte al servidor primero:\n{invite}',
        de: 'Du musst zuerst dem Server beitreten:\n{invite}',
        zh: '你必须先加入服务器：\n{invite}',
        hi: 'पहले सर्वर में शामिल हों:\n{invite}',
    },
    choose_language: {
        ar: '### اختر لغتك\nSelect your language',
        en: '### Choose your language\nSelect your language',
        fr: '### Choisissez votre langue',
        ru: '### Выберите язык',
        es: '### Elige tu idioma',
        de: '### Wähle deine Sprache',
        zh: '### 选择你的语言',
        hi: '### अपनी भाषा चुनें',
    },
    language_set: {
        ar: '✅ تم تعيين اللغة إلى **العربية**',
        en: '✅ Language set to **English**',
        fr: '✅ Langue définie sur **Français**',
        ru: '✅ Язык установлен на **Русский**',
        es: '✅ Idioma establecido en **Español**',
        de: '✅ Sprache auf **Deutsch** gesetzt',
        zh: '✅ 语言已设置为 **中文**',
        hi: '✅ भाषा **हिन्दी** पर सेट की गई',
    },
    no_token: {
        ar: '❌ ما في توكن مرتبط.\nاستخدم `/quest token:YOUR_TOKEN` أو `/vip-quest token:YOUR_TOKEN`',
        en: '❌ No token linked.\nUse `/quest token:YOUR_TOKEN` or `/vip-quest token:YOUR_TOKEN`',
        fr: '❌ Aucun token lié.\nUtilisez `/quest token:VOTRE_TOKEN`',
        ru: '❌ Токен не привязан.\nИспользуйте `/quest token:ВАШ_ТОКЕН`',
        es: '❌ No hay token vinculado.\nUsa `/quest token:TU_TOKEN`',
        de: '❌ Kein Token verknüpft.\nVerwende `/quest token:DEIN_TOKEN`',
        zh: '❌ 未绑定令牌。\n使用 `/quest token:你的令牌`',
        hi: '❌ कोई टोकन लिंक नहीं।\n`/quest token:आपका_टोकन` उपयोग करें',
    },
    token_invalid: {
        ar: '❌ التوكن غلط أو منتهي. جيب توكن جديد باستخدام `/script`',
        en: '❌ Invalid or expired token. Get a new one with `/script`',
        fr: '❌ Token invalide ou expiré. Obtenez-en un nouveau avec `/script`',
        ru: '❌ Неверный или истёкший токен. Получите новый через `/script`',
        es: '❌ Token inválido o caducado. Obtén uno nuevo con `/script`',
        de: '❌ Ungültiger oder abgelaufener Token. Hole einen neuen mit `/script`',
        zh: '❌ 令牌无效或已过期。使用 `/script` 获取新令牌',
        hi: '❌ अमान्य या समाप्त टोकन। `/script` से नया लें',
    },
    no_active_quests: {
        ar: '✅ ما في مهام ناقصة حالياً.',
        en: '✅ No active incomplete quests right now.',
        fr: '✅ Aucune quête active incomplète pour le moment.',
        ru: '✅ Сейчас нет незавершённых квестов.',
        es: '✅ No hay misiones activas incompletas ahora.',
        de: '✅ Derzeit keine aktiven unvollständigen Quests.',
        zh: '✅ 目前没有未完成的任务。',
        hi: '✅ अभी कोई अधूरे क्वेस्ट नहीं हैं।',
    },
    vip_only: {
        ar: '❌ هذا الأمر للـ VIP فقط.\nاحصل على الرتبة في السيرفر عشان تستخدمه.',
        en: '❌ This command is VIP only.\nGet the role in the server to use it.',
        fr: '❌ Cette commande est réservée aux VIP.',
        ru: '❌ Эта команда только для VIP.',
        es: '❌ Este comando es solo para VIP.',
        de: '❌ Dieser Befehl ist nur für VIP.',
        zh: '❌ 此命令仅限 VIP。',
        hi: '❌ यह कमांड केवल VIP के लिए है।',
    },
    quest_found: {
        ar: '### 🎯 لقيت {count} مهمة ناقصة',
        en: '### 🎯 Found {count} incomplete quest(s)',
        fr: '### 🎯 {count} quête(s) incomplète(s) trouvée(s)',
        ru: '### 🎯 Найдено незавершённых квестов: {count}',
        es: '### 🎯 Se encontraron {count} misión(es) incompleta(s)',
        de: '### 🎯 {count} unvollständige Quest(s) gefunden',
        zh: '### 🎯 找到 {count} 个未完成任务',
        hi: '### 🎯 {count} अधूरे क्वेस्ट मिले',
    },
    select_quest: {
        ar: 'اختر مهمة من القائمة تحت.\nالبوت راح يبدأ يسويها تلقائياً بعد الاختيار.',
        en: 'Select a quest from the menu below.\nThe bot will start it automatically after selection.',
        fr: 'Sélectionnez une quête dans le menu ci-dessous.',
        ru: 'Выберите квест из меню ниже.',
        es: 'Selecciona una misión del menú de abajo.',
        de: 'Wähle eine Quest aus dem Menü unten.',
        zh: '从下方菜单选择任务。',
        hi: 'नीचे मेनू से क्वेस्ट चुनें।',
    },
    cooldown_wait: {
        ar: '⏳ خلصت المهمة. المهمة الجاية **{name}** بعد {sec} ثانية\nاضغط **توقف** لإلغاء الطابور.',
        en: '⏳ Quest done. Next **{name}** in {sec}s\nPress **Stop** to cancel the queue.',
        fr: '⏳ Quête terminée. Prochaine **{name}** dans {sec}s',
        ru: '⏳ Квест завершён. Следующий **{name}** через {sec}с',
        es: '⏳ Misión terminada. Siguiente **{name}** en {sec}s',
        de: '⏳ Quest fertig. Nächste **{name}** in {sec}s',
        zh: '⏳ 任务完成。下一个 **{name}** 还有 {sec} 秒',
        hi: '⏳ क्वेस्ट पूरा। अगला **{name}** {sec} सेकंड में',
    },
    cooldown_done: {
        ar: '✅ انتهى الانتظار. جاري تشغيل **{name}**',
        en: '✅ Cooldown over. Starting **{name}**',
        fr: '✅ Cooldown terminé. Démarrage de **{name}**',
        ru: '✅ Ожидание закончено. Запуск **{name}**',
        es: '✅ Cooldown terminado. Iniciando **{name}**',
        de: '✅ Abklingzeit vorbei. Starte **{name}**',
        zh: '✅ 冷却结束。开始 **{name}**',
        hi: '✅ कूलडाउन खत्म। **{name}** शुरू',
    },
    auto_enabled: {
        ar: '✅ تم تفعيل الوضع التلقائي (VIP).\nلما تنزل مهمة جديدة راح يجيك إشعار خاص ويتم تشغيلها أوتوماتيك.',
        en: '✅ Auto mode enabled (VIP).\nYou will get a DM when a new quest drops and it will start automatically.',
        fr: '✅ Mode auto activé (VIP).',
        ru: '✅ Авто-режим включён (VIP).',
        es: '✅ Modo automático activado (VIP).',
        de: '✅ Auto-Modus aktiviert (VIP).',
        zh: '✅ 自动模式已启用 (VIP)。',
        hi: '✅ ऑटो मोड चालू (VIP)।',
    },
    auto_disabled: {
        ar: '⏹️ تم إيقاف الوضع التلقائي.',
        en: '⏹️ Auto mode disabled.',
        fr: '⏹️ Mode auto désactivé.',
        ru: '⏹️ Авто-режим отключён.',
        es: '⏹️ Modo automático desactivado.',
        de: '⏹️ Auto-Modus deaktiviert.',
        zh: '⏹️ 自动模式已关闭。',
        hi: '⏹️ ऑटो मोड बंद।',
    },
    new_quest_dm: {
        ar: '### 🎯 مهمة جديدة!\n**{name}**\nاللعبة: {game}\nتنتهي: {expires}\n\nالبوت راح يبدأها تلقائياً بعد قليل (وضع VIP).',
        en: '### 🎯 New Quest!\n**{name}**\nGame: {game}\nExpires: {expires}\n\nBot will start it automatically shortly (VIP mode).',
        fr: '### 🎯 Nouvelle quête !\n**{name}**\nJeu : {game}',
        ru: '### 🎯 Новый квест!\n**{name}**\nИгра: {game}',
        es: '### 🎯 ¡Nueva misión!\n**{name}**\nJuego: {game}',
        de: '### 🎯 Neue Quest!\n**{name}**\nSpiel: {game}',
        zh: '### 🎯 新任务！\n**{name}**\n游戏：{game}',
        hi: '### 🎯 नया क्वेस्ट!\n**{name}**\nगेम: {game}',
    },
    stats_title: {
        ar: '### 📊 إحصائياتك',
        en: '### 📊 Your Stats',
        fr: '### 📊 Vos statistiques',
        ru: '### 📊 Ваша статистика',
        es: '### 📊 Tus estadísticas',
        de: '### 📊 Deine Statistiken',
        zh: '### 📊 你的统计',
        hi: '### 📊 आपके आँकड़े',
    },
    help_placeholder: {
        ar: '### 📖 المساعدة
`/start` `/quest` `/vip-quest` `/claim` (Pro) `/stats` `/script` `/help`
`/quest-room` (Starter)
`/owner-tokens` (Owner)',
        en: '### 📖 Help
`/start` `/quest` `/vip-quest` `/claim` (Pro) `/stats` `/script` `/help`
`/quest-room` (Starter)
`/owner-tokens` (Owner)',
        fr: '### 📖 Aide\nBientôt : vidéo + token.',
        ru: '### 📖 Помощь\nСкоро: видео + токен.',
        es: '### 📖 Ayuda\nPróximamente: vídeo + token.',
        de: '### 📖 Hilfe\nDemnächst: Video + Token.',
        zh: '### 📖 帮助\n即将推出：视频 + 令牌。',
        hi: '### 📖 मदद\nजल्द: वीडियो + टोकन।',
    },
    token_expired_notify: {
        ar: '⚠️ **تنبيه:** توكنك منتهي أو غير صالح.\nاستخدم `/script` عشان تجيب توكن جديد ثم أعد المحاولة.',
        en: '⚠️ **Alert:** Your token is expired or invalid.\nUse `/script` to get a new token then try again.',
        fr: '⚠️ **Alerte :** Token expiré ou invalide.',
        ru: '⚠️ **Внимание:** Токен истёк или недействителен.',
        es: '⚠️ **Alerta:** Token caducado o inválido.',
        de: '⚠️ **Warnung:** Token abgelaufen oder ungültig.',
        zh: '⚠️ **提醒：** 你的令牌已过期或无效。',
        hi: '⚠️ **अलर्ट:** आपका टोकन समाप्त या अमान्य है।',
    },
    only_one_running: {
        ar: '❌ في مهمة شغالة حالياً. خلصها أو أوقفها أولاً.',
        en: '❌ A quest is already running. Finish or stop it first.',
        fr: '❌ Une quête est déjà en cours.',
        ru: '❌ Квест уже выполняется.',
        es: '❌ Ya hay una misión en curso.',
        de: '❌ Es läuft bereits eine Quest.',
        zh: '❌ 已有任务在运行。',
        hi: '❌ पहले से एक क्वेस्ट चल रहा है।',
    },
    quest_room_set: {
        ar: '✅ تم تعيين روم المهام: {channel}',
        en: '✅ Quest room set to: {channel}',
        fr: '✅ Salle des quêtes définie : {channel}',
        ru: '✅ Комната квестов: {channel}',
        es: '✅ Sala de misiones: {channel}',
        de: '✅ Quest-Raum gesetzt: {channel}',
        zh: '✅ 任务频道已设为：{channel}',
        hi: '✅ क्वेस्ट रूम सेट: {channel}',
    },
    start_welcome: {
        ar: '### 👋 أهلاً بك في Quest Bot\nاختر لغتك للبدء:',
        en: '### 👋 Welcome to Quest Bot\nChoose your language to start:',
        fr: '### 👋 Bienvenue sur Quest Bot\nChoisissez votre langue :',
        ru: '### 👋 Добро пожаловать в Quest Bot\nВыберите язык:',
        es: '### 👋 Bienvenido a Quest Bot\nElige tu idioma:',
        de: '### 👋 Willkommen beim Quest Bot\nWähle deine Sprache:',
        zh: '### 👋 欢迎使用 Quest Bot\n选择你的语言：',
        hi: '### 👋 Quest Bot में आपका स्वागत है\nअपनी भाषा चुनें:',
    },
};

function t(lang, key, vars = {}) {
    const langKey = (lang && STRINGS[key] && STRINGS[key][lang]) ? lang : 'en';
    let text = (STRINGS[key] && STRINGS[key][langKey]) || (STRINGS[key] && STRINGS[key].en) || key;
    for (const [k, v] of Object.entries(vars)) {
        text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
    return text;
}

function getLanguageOptions() {
    return Object.entries(LANGUAGES).map(([code, { name, flag }]) => ({
        label: `${flag} ${name}`,
        value: code,
    }));
}

module.exports = { LANGUAGES, STRINGS, t, getLanguageOptions };
