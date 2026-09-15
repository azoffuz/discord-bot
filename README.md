# 🤖 Cleva — Ko'p Funksiyali Discord Boti (discord.js v14)

**Cleva** zamonaviy **discord.js v14** texnologiyasida yozilgan bo'lib, o'zida kuchli moderatsiya, log tizimi (audit log), moslashuvchan welcome xabarlari, tugmali Ticket (yordam markazi) tizimi, e'lonlar, so'rovnomalar hamda **Render.com** bepul hostingida 24/7 uzluksiz ishlash imkoniyatini jamlagan.

---

## 📌 Barcha Buyruqlar (Slash Commands)

### 🛡️ Moderatsiya va Xavfsizlik
- `/give-role [user] [role]` — Foydalanuvchiga belgilangan rolni xavfsiz berish (ierarxiyani tekshiradi).
- `/remove-role-from [remove_role] [having_role]` — 1-tanlangan rolni 2-roli bor barcha foydalanuvchilardan bittada olib tashlash.
- `/mute [user] [duration] [reason]` — Foydalanuvchini vaqtinchalik ovozini o'chirish (Timeout: `60s`, `10m`, `1h`, `7d`).
- `/unmute [user] [reason]` — Mute jazo muddatini bekor qilish.
- `/del-warn [user] [reason] [message_id]` — Qoidabuzar xabarini o'chiradi va ogohlantirish (warn) yozadi (DM yuboradi).
- `/warns [list | remove | clear]` — Ogohlantirishlar ro'yxatini ko'rish, bitta warnni o'chirish yoki hammasini tozalash.
- `/lock [channel] [reason]` — Kanalni oddiy a'zolar uchun yozishdan vaqtincha qulflaydi (Lockdown).
- `/unlock [channel]` — Qulflangan kanalni qayta ochadi.
- `/clear [count] [user]` — Chatdagi xabarlarni ommaviy tozalash (1 dan 100 tagacha).
- `/audit-log [tur] [soni]` — Serverda xabarlarni kim o'chirgani yoki AutoMod bloklaganini Audit Log orqali ko'rish.

### ⚙️ Server Sozlamalari va Tizimlar
- `/set-log [category] [external_category_id] [external_channel_id] [disable]` — **Kategoriyalangan Log Tizimi:** Kategoriya ichida avtomat 5 ta yopiq kanal ochadi (`#xabar-loglari`, `#azo-loglari`, `#moderatsiya-loglari`, `#ticket-loglari`, `#ovozli-loglar`). Shuningdek, boshqa serveringizdagi kategoriya yoki kanal ID sini berish orqali **serverlararo log (Cross-Server Logging)** qilish imkoniyatiga ega.
- `/set-ticket [channel] [category] [support_role]` — **Tugmali Ticket Tizimi:** Murojaat va rol olish anketalari markazi. Yopilganda transcript saqlanadi.
- `/set-autorole [role] [disable]` — **Auto-Role:** Yangi kirgan har bir a'zoga ushbu rolni avtomat biriktiradi.
- `/set-verify [status] [role] [channel] [type] [title] [description]` — **Kaptcha va Tekshiruv (Verification):** Serverni spamer va botlardan himoyalash. Yangi a'zolarga tugmali panel, 4 xonali kod yoki matematik misol orqali a'zo rolini berish.
- `/set-antilink [status] [add_domain] [remove_domain] [list_whitelist]` — **Anti-Link & Whitelist:** Begona reklama va havolalarni o'chirish. GIF va media servislar (`klipy.com`, `tenor.com`, `giphy.com`, server taklif havolasi) avtomatik ruxsat etilgan, adminlar maxsus domenlarni ham qo'shishi mumkin.
- `/set-stats [status] [external_category_id] [external_guild_id] [category]` — **Server Statistikasi & Cross-Server Stats:** Jonli ovozli hisoblagich kanallari: 👥 Jami A'zolar, 👤 Oddiy A'zolar, 🤖 Botlar, 🟢 Onlayn A'zolar, 🚀 Boosterlar, 🎙️ Ovozdagilar. O'z serveringizda yoki 2-serveringizda (Cross-Server) ochish, o'chirish va yangilash.
- `/set-tempvoice status:[enable/disable]` — **Shaxsiy Ovozli Xonalar:** "➕ Xona Yaratish" ga kirganda yangi xona ochib ko'chirish va bo'shagach o'chirish.
- `/set-level status:[enable/disable] [channel]` — **Level & XP Sozlamasi:** Chatda faollik uchun daraja oshirish tizimini yoqish/o'chirish.
- `/set-media-roles [status] [add_role] [remove_role] [clear_all]` — **Rasm va GIF Cheklovi (Media-Roles):** Faqat tanlangan rollarga rasm/GIF yuborish huquqini berish. Ruxsatsiz yuborilgan rasmlar avtomatik o'chiriladi.
- `/set-youtube` (yoki `/set-video`) `[youtube_channel] [channel] [ping_role] [message] [test]` — **YouTube Avto-Xabarnoma (Notifier):** YouTube kanaliga yangi video yoki Shorts yuklanganda Discord kanaliga avtomat e'lon qilish.

### 📢 E'lonlar va So'rovnomalar
- `/say [message] [channel]` — Bot nomidan istalgan kanalda oddiy matnli xabar yuborish.
- `/embed [title] [description] [color] [image] [thumbnail] [footer] [channel]` — Bot nomidan chiroyli ramkali, rangli va rasmli rasmiy e'lon chiqarish.
- `/poll [question] [option1] [option2] [option3..5]` — 2 dan 5 tagacha variantli ovoz berish so'rovnomasi. Foydalanuvchilar emojilar orqali ovoz berishadi.

### ℹ️ Umumiy va Ma'lumot
- `/chats-list [yashirin]` — Serverdagi barcha kategoriyalar va ularning ichidagi kanallar (chatlar) ro'yxatini to'liq chiqarish.
- `/rank [user]` — O'zingizning yoki boshqa a'zoning darajasi (Level), tajribasi (XP), serverdagi o'rni va progress barini ko'rish.
- `/leaderboard` — Serverdagi eng faol a'zolar TOP-10 reytingi va darajalarini ko'rish.
- `/avatar [type] [user]` — O'zingizning, boshqa a'zoning yoki butun serverning rasmi (Icon va Banner)ni eng yuqori **4096px HD** sifatda ko'rish va yuklab olish.
- `/roles` — Serverdagi barcha rollar va har bir roldagi a'zolar sonini ko'rsatadi.
- `/server-info` — Server haqida to'liq statistika (egasi, ochilgan sana, a'zolar/botlar, kanallar, boostlar).
- `/user-info [user]` — Foydalanuvchi profili, hisob ochilgan sana, serverga kirgan vaqti, rollari va jami warnlari.
- `/help` — **Mukammal interaktiv qo'llanma.** Dropdown menyu orqali barcha buyruqlar va ularning vazifalarini toifalar bo'yicha ko'rish mumkin.

---

## 🔒 Xavfsizlik: Serverlar Cheklovi va Ruxsatlar

Bot begona serverlarda ishlamasligi va faqat sizning serverlaringizga xizmat qilishi uchun ikkita maxsus muhit o'zgaruvchisi kiritilgan:
1. **`ALLOWED_GUILD_ID`** — Botingiz ishlaydigan ruxsat etilgan server(lar) ID si:
   - **Bitta server:** `987654321098765432`
   - **Bir nechta server (Multi-Server):** Vergul bilan ajratib yoziladi, masalan: `987654321098765432,123456789012345678` (Asosiy serveringiz va Loglar uchun 2-serveringiz ID si).
   - Bot faqat ro'yxatdagi serverlardagi buyruqlarga javob beradi.
   - Agar kimdir botni ruxsatsiz begona serverga qo'shsa, bot darhol avtomatik chiqib ketadi (`guild.leave()`).
   - Slash buyruqlar ruxsat berilgan barcha serverlarga avtomatik va zudlik bilan sinxronlanadi.
2. **`OWNER_ID`** — Asosiy adminning (sizning) shaxsiy Discord hisobingiz ID si.

---

## ☁️ Render.com da Environment Variables (ENV)

Render.com boshqaruv panelida **Environment Variables** bo'limiga quyidagilarni kiritasiz:

| Key (Kalit) | Qiymat misoli (Value) | Izoh |
|---|---|---|
| `DISCORD_TOKEN` | `MTE5OT...` | Bot tokeni (Developer Portal -> Bot -> Reset Token) |
| `CLIENT_ID` | `123456789012345678` | Bot Application ID si |
| `ALLOWED_GUILD_ID` | `987654321098765432,123456789012345678` | **Ruxsat etilgan serverlar ID si (vergul bilan bir nechta ID yozish mumkin)** |
| `OWNER_ID` | `876543210987654321` | **Sizning shaxsiy Discord hisobingiz ID si** |
| `PORT` | `3000` | Veb-server porti |
| `AUTO_DEPLOY` | `true` | Buyruqlarni avtomat ro'yxatdan o'tkazish |
| `SUPABASE_URL` | `https://xxxx.supabase.co` | Supabase Project URL (Sozlamalar esdan chiqmasligi uchun) |
| `SUPABASE_KEY` | `eyJh...` | Supabase Anon / Service API Key |
| `SERVER_INVITE_URL` | `https://discord.gg/fwVyfrtP4h` | Server taklif havolasi (Bot statusi va /help tugmasi uchun) |

---

## 🗄️ Supabase Bazasini Ulash (Deployda Sozlamalar O'chmasligi Uchun)

Render.com har safar yangi deploy bo'lganda server diskini tozalaydi. Barcha sozlamalar (ticketlar, log kanallari, warnlar) abadiy saqlanib turishi uchun:

1. [Supabase.com](https://supabase.com) ga kiring va bepul yangi loyiha (New Project) oching.
2. Chap menyudan **SQL Editor** bo'limiga o'ting va quyidagi kodni ishga tushiring (**Run**):
   ```sql
   create table if not exists guild_settings (
     guild_id text primary key,
     data jsonb
   );

   -- RLS ni o'chirish (Bot ma'lumotlarni saqlay olishi uchun):
   alter table guild_settings disable row level security;
   ```
3. **Project Settings -> API** bo'limidan:
   - **Project URL** ni oling (`SUPABASE_URL`)
   - **Project API Keys** dan `service_role` (yoki `anon public`) kalitini oling (`SUPABASE_KEY`)
4. Ularni Render.com da **Environment Variables** ga qo'shing. Bo'ldi! Endi har qanday deployda ham hamma sozlamalar to'liq saqlanib qoladi.

---

## ⏰ 24/7 Keep-Alive (UptimeRobot)

Render.com da botingiz uxlab qolmasligi uchun:
1. Render veb-manzilingizni nusxalang (masalan: `https://discord-bot-xxxx.onrender.com`).
2. [UptimeRobot.com](https://uptimerobot.com) da bepul monitor oching:
   - **Type:** `HTTP(s)`
   - **URL:** `https://discord-bot-xxxx.onrender.com`
   - **Interval:** `5 minutes`

---

## 🌐 Serverlararo Log Tizimi (Cross-Server Logging)

Agar siz asosiy serveringizdagi barcha loglarni (xabarlar, yangi a'zolar, moderatsiya, ovozli harakatlar) alohida 2-serveringizga yubormoqchi bo'lsangiz:

1. **Botni 2-serveringizga ham taklif qiling.**
2. Render.com da **`ALLOWED_GUILD_ID`** o'zgaruvchisiga ikkala server ID sini vergul bilan yozing:
   `ASOSIY_SERVER_ID,LOG_SERVER_ID`
3. 2-serveringizda biror kategoriya oching (masalan: `📊 CLEVA LOGLAR`) va uning ID sini nusxalang (kategoriyani o'ng tugma bilan bosib "Copy ID").
4. Asosiy serveringizda admin nomidan quyidagi buyruqni ishga tushiring:
   `/set-log external_category_id:LOG_SERVER_KATEGORIYA_ID`
5. Bot o'sha 2-serveringizdagi kategoriya ichida avtomatik ravishda 5 ta maxsus log kanalini (`#xabar-loglari`, `#azo-loglari`, `#moderatsiya-loglari`, `#ticket-loglari`, `#ovozli-loglar`) ochadi va barcha loglarni to'g'ridan-to'g'ri o'sha yerga yo'naltiradi! Har bir log xabarining ostida esa qaysi serverdan kelganligi (`🌐 Server: [Server Nomi]`) ko'rsatib boriladi.

---

## 📊 Serverlararo Statistika (Cross-Server Stats)

Asosiy serveringiz statistikasi (Jami a'zolar, botlar, onlaynlar, boosterlar, ovozdagilar) hisoblagichlarini 2-serveringizda ko'rsatish:

- **1-usul (Mavjud kategoriyaga joylash):**
  2-serveringizdagi biror kategoriya ID sini nusxalang va asosiy serveringizda quyidagicha yuboring:
  ```text
  /set-stats status:enable external_category_id:2_SERVER_KATEGORIYA_ID
  ```
- **2-usul (Avtomat kategoriya ochish):**
  2-serveringizning o'zini ID sini nusxalab quyidagicha yuboring:
  ```text
  /set-stats status:enable external_guild_id:2_SERVER_ID
  ```
  Bot 2-serveringizda avtomatik ravishda `📊・[Server Nomi] STATS` nomli yangi kategoriya ochib, 6 ta hisoblagich kanalini yaratadi!

---

## 🛡️ Kaptcha va Tekshiruv Tizimi (Verification System)

Serveringizni spambotlar va begona reklamachilardan 100% himoya qilish uchun:

1. Serveringizda a'zolarga beriladigan rolni aniqlang (masalan: `@A'zo`).
2. Tekshiruv o'tkaziladigan kanalni oching (masalan: `#tekshiruv`).
3. Buyruqni ishga tushiring:
   ```text
   /set-verify status:enable role:@A'zo channel:#tekshiruv
   ```
4. **Tekshiruv usullari (`type` opsiyasi orqali):**
   - `button` (Standart) — 1 marta yashil tugmani bosish orqali kirish.
   - `code` — Tasodifiy 4 xonali son kodi kiritilishi shart.
   - `math` — Oddiy matematik misolni yechish (masalan: `8 + 5 = ?`).
5. **Muhim sozlash:** Umumiy chatlaringiz sozlamalarida `@everyone` rolidan *"Kanallarni Ko'rish"* (View Channels) ruxsatini o'chirib, faqat `@A'zo` roliga ruxsat bering. Yangi a'zolar kirganda faqat `#tekshiruv` kanalini ko'radi va tekshiruvdan o'tgachgina qolgan barcha chatlar ochiladi!
6. Tizimni o'chirish:
   ```text
   /set-verify status:disable
   ```



