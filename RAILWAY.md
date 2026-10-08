# رفع البوت على Railway

## 1) تجهيز ديسكورد
1. روح [Discord Developer Portal](https://discord.com/developers/applications)
2. اختر التطبيق / أنشئ واحد
3. Bot → Reset Token → انسخ التوكن
4. فعّل Privileged Gateway Intents إذا لزم (Message Content إذا تحتاجه)
5. OAuth2 → URL Generator → scopes: `bot` + `applications.commands`
6. صلاحيات البوت: Send Messages, Embed Links, Use Slash Commands, Read Message History, Manage Messages (اختياري)
7. ادعُ البوت لسيرفرك

## 2) رفع المشروع على Railway
1. ادخل [railway.app](https://railway.app) وسجّل دخول
2. New Project → Deploy from GitHub (ارفع المشروع على GitHub)  
   أو Deploy from local / CLI
3. اختر الخدمة (Service)

## 3) متغيرات البيئة (Variables)
في Railway → Variables أضف:

| المتغير | مطلوب؟ | مثال |
|---------|--------|------|
| `BOT_TOKEN` | نعم | توكن البوت من Developer Portal |
| `DB_PATH` | مستحسن | `/data/store.db` |
| `APP_COMMAND_SYNC_SCOPE` | لا | `global` أو `guild` |
| `LOG_GUILD_ID` | للنشر التلقائي للمهام | آيدي السيرفر |
| `LOG_CHANNEL_ID` | للنشر التلقائي للمهام | آيدي القناة |
| `LINK_LOG_GUILD_ID` | اختياري | آيدي سيرفر اللوج |
| `LINK_LOG_CHANNEL_ID` | اختياري | آيدي قناة اللوج |

**مهم:** لا تحط توكن البوت داخل `config.json` على GitHub. استخدم Variables فقط.

## 4) Volume للقاعدة (مهم)
بدون Volume كل إعادة نشر تمسح قاعدة البيانات (التوكنات المحفوظة).

1. في الخدمة → Settings أو Volumes
2. أضف Volume على المسار: `/data`
3. حط المتغير: `DB_PATH=/data/store.db`

## 5) إعدادات الخدمة
- **Start Command:** `npm start` (افتراضي من package.json)
- مش محتاج Public Domain أو Port — هذا بوت ديسكورد مو موقع
- إذا Railway طلب Healthcheck: عطّله أو تجاهله

## 6) بعد التشغيل
1. شوف الـ Logs: لازم يطلع `Logged in. Bot ID: ...`
2. الأوامر السلاش (`/quest` `/stats` ...) قد تاخذ دقيقة لمزامنة Global
3. جرب بالخاص مع البوت: `/quest token:USER_TOKEN`

## 7) أوامر البوت
- `/quest` — بالخاص: تشغيل مهام | بالسيرفر: عرض بطاقات
- `/stats` — إحصائياتك
- `/link` `/unlink` `/script` — ربط التوكن
- `/auto` — الوضع التلقائي (إن مفعّل)

## مشاكل شائعة
- **BOT_TOKEN is missing** → حط المتغير في Railway Variables
- **better-sqlite3 build failed** → تأكد nixpacks.toml موجود (يثبيت python/gcc)
- **بيانات تضيع بعد Deploy** → أضف Volume على `/data` و `DB_PATH=/data/store.db`
- **الأوامر ما تظهر** → انتظر أو غيّر `APP_COMMAND_SYNC_SCOPE=guild` مع `LOG_GUILD_ID`
