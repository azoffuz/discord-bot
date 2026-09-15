# Cleva — Optimizatsiya Auditi

**Sana:** 2026-yil 15-sentyabr
**Qamrov:** `src/` — 65 ta JS fayl, ~10 000 qator
**Stek:** Node.js 24, discord.js v14, Supabase (jsonb), Express, Render.com

Ushbu hujjatda botning ishlash tezligi bo'yicha topilgan barcha kamchiliklar,
ularning qaysilari tuzatilgani va nima qilish qolgani yozilgan.

---

## Umumiy natija

| Holat | Soni |
|---|---|
| ✅ Tuzatildi | 17 ta |
| ⬜ Qoldi | 0 ta |

**Tuzatilgan commitlar:**

| Commit | Nima qilindi |
|---|---|
| `632052e` | B3 + QW1 + QW8 — standart sozlamalar, diskka yozish, reyting hisobi |
| `2bbc069` | B2 — Supabase uchun navbat (write-behind queue) |
| `6f8d21c` | QW2 + QW3 — keraksiz tarmoq so'rovlarini to'xtatish |
| `30b5fa1` | B1 — issiq ma'lumotlarni alohida jadvallarga ajratish |
| `(keyingi)` | QW4 + QW5 + QW6 + QW7 + QW9 — eskirgan API va issiq yo'l tozalash |
| `(keyingi)` | B4 — ovozli sessiyalarni deploydan omon saqlash |
| `(keyingi)` | B6 + B5 — darajali logger va buyruqlar uchun umumiy qatlam |
| `(keyingi)` | QW11 — veb sahifalarni ajratish va keshlash |

---

## ✅ TUZATILGAN

### QW1 — Har o'zgarishda butun baza diskka sinxron yozilardi 🔴

**Muammo.** `updateGuildSettings` har chaqirilganda `fs.writeFileSync` orqali
**barcha serverlar** ma'lumotini, chiroyli formatda (`null, 2`), **sinxron**
tarzda diskka yozardi. Bu 46 ta joydan chaqiriladi. Har bir chat xabari uchun
2 marta ishga tushardi (`addXP` + `updateMemberActivity`). 500 a'zoli serverda
bu har safar megabaytlab ma'lumotni qayta yozish va event loop ni to'xtatish
degani edi.

**Yechim.** Dirty-flag + 2 soniyalik kechikish (debounce), asinxron va atomar
yozish (`.tmp` → `rename`). Format ixchamlashtirildi. Yopilishda
(`SIGINT`/`SIGTERM`/`exit`) majburiy saqlash qo'shildi.

**Natija (500 a'zoli server, 2000 ta yangilanish):**

```
Eski:  9964.5 ms   (har yozuv ~4982 mikrosekund, event loop bloklanadi)
Yangi:     1.6 ms   (har yozuv ~1 mikrosekund)
```

`src/config/storage.js` · commit `632052e`

---

### QW2 — Log kanali yo'q bo'lsa ham audit log so'rovlari yuborilardi

**Muammo.** `logMessageDelete` avval 800 ms kutardi va 2 tagacha
`fetchAuditLogs` so'rovi yuborardi — **keyin** `sendLog` ichida log kanali
umuman sozlanmaganini bilardi. Ya'ni log yoqilmagan serverda ham har
o'chirilgan xabar uchun 800 ms + 2 ta REST so'rov behuda ketardi.

**Yechim.** `getLogChannelId()` funksiyasi ajratildi — u faqat sozlamalarni
o'qiydi, tarmoqqa chiqmaydi. `logMessageDelete` shu bilan boshlanadi va kanal
yo'q bo'lsa darhol qaytadi. Log sozlangan holatda so'rovlar soni o'zgarmadi.

`src/utils/logger.js` · commit `6f8d21c`

---

### QW3 — Har ovozli harakatda butun a'zolar ro'yxati tortib olinardi 🔴

**Muammo.** `updateGuildStats` har safar `guild.members.fetch()` (serverdagi
**hamma** a'zo) va `guild.fetch()` chaqirardi. Bu funksiya esa
`voiceStateUpdate` dan **har bir kanal almashuvida** ishga tushardi, ustiga
10 daqiqalik interval va a'zo kirish/chiqishlarida ham. Kanal nomini
o'zgartirish allaqachon 5 daqiqaga cheklangani uchun bu trafikning deyarli
hammasi behuda edi.

**Yechim.**
- Har server uchun 5 daqiqalik to'xtatgich — **tarmoqqa chiqishdan oldin** ishlaydi.
- A'zolar ro'yxati faqat bot/booster/odam hisoblagichi kerak bo'lsa **va** kesh
  to'liq bo'lmasa tortiladi.
- `guild.fetch()` faqat "jami" yoki "onlayn" hisoblagichi sozlangan bo'lsa.

Faqat ovoz hisoblagichi yoqilgan serverda endi **0 ta REST so'rov** ketadi.

`src/utils/statsUpdater.js` · commit `6f8d21c`

---

### QW8 — `/rank` butun jadvalni saralardi

**Muammo.** `getUserLevel` bitta odamning o'rnini bilish uchun serverdagi
barcha foydalanuvchini massivga yig'ib saralar edi — O(n log n).

**Yechim.** Bitta o'tishda (O(n)) sanash, ortiqcha massiv yaratmasdan.
Natija eski usul bilan bir xil ekani testda tekshirildi.

`src/config/storage.js` · commit `632052e`

---

### QW10 — `substr` eskirgan

`addWarn` dagi ID yaratishda `.substr()` ishlatilgandi → `.slice()` ga
almashtirildi.

`src/config/storage.js` · commit `632052e`

---

### B3 — Standart sozlamalar 5 joyda takrorlanardi (va bir joyda xato edi) 🔴

**Muammo.** `getGuildSettings` ichida ~145 qatorlik `if (!x) x = {...}`
"migratsiya narvoni" bor edi va u **har o'qishda** ishga tushardi (har xabar,
har log, har tugma bosilishi). Standart qiymatlar takrorlanardi:

- `activeRole` — **5 marta** yozilgan
- `teamArchive` — **4 marta** yozilgan

Va ular allaqachon bir-biridan farq qila boshlagan edi:

```js
// storage.js:511 — 7 ta kalit
{ fillChannelId, channelId, headRoleId, moderRoleId, pingRoleId, allowPublicView, members }
// storage.js:524 (saveTeamMember) — atigi 4 ta kalit
{ channelId, headRoleId, moderRoleId, members }
```

**Bu haqiqiy xato edi:** agar serverning `teamArchive` bo'limi birinchi marta
`saveTeamMember` orqali yaratilsa, unda `fillChannelId`, `pingRoleId` va
`allowPublicView` umuman bo'lmasdi.

**Yechim.**
- Bitta `DEFAULT_SETTINGS` obyekti — yangi xossa qo'shish uchun faqat shu yer
  tahrirlanadi.
- `applyDefaults()` rekursiv to'ldiradi va **har server uchun bir marta**
  ishlaydi (har o'qishda emas).
- Foydalanuvchi kaliti bilan to'ldiriladigan lug'atlar (`warns`,
  `leveling.users`, `teamArchive.members`, `activeRole.members`) bo'sh `{}`
  deb belgilandi — ichiga kirilmaydi, soxta yozuv qo'shilmaydi.
- Tekshiruv qattiqlashtirildi: eski kod `if (!x)` ishlatardi, yangisi faqat
  `undefined`/`null` ni to'ldiradi — shuning uchun ataylab qo'yilgan
  `false` yoki `0` endi hech qachon standart qiymatga qaytmaydi.

`src/config/storage.js` · commit `632052e`

---

### B2 — Supabase ga yozuvlar "yuborib-unutilardi" 🔴

**Muammo.** Uchta jiddiy kamchilik:

1. `updateGuildSettings` har o'zgarishda `await` siz upsert yuborardi — har
   xabar uchun bitta tarmoq so'rovi.
2. Xatolik bo'lsa faqat `console.warn` chiqardi — ma'lumot keyingi deployda
   yo'qolardi.
3. Eng yomoni:
   ```js
   if (!supabase || !supabaseStatus.connected) return;
   ```
   `connected` faqat `init()` da bir marta o'rnatilardi. Boot paytida bitta
   vaqtinchalik uzilish bo'lsa — **butun jarayon davomida saqlash o'chib
   qolardi**, Render da esa lokal fayl deployda o'chib ketadi.

**Yechim.** Write-behind navbat:
- Kutayotgan server ID lari `Set` da to'planadi, 2 soniyalik kechikish bilan
  yuboriladi. Bir serverga 500 ta o'zgarish → **1 ta** so'rov. Bir nechta
  server → **1 ta** umumiy so'rov.
- Xatolikda qayta navbatga qo'yiladi, kechikish 1s → 2s → ... → 60s gacha
  oshadi.
- Muvaffaqiyatli yozuv holatni tiklaydi — yomon `init()` endi saqlashni
  butunlay o'chirib qo'ymaydi.
- `getSupabaseStatus()` ga `.pending` qo'shildi, `/health` sahifasi buni
  allaqachon ko'rsatadi.
- `SIGINT`/`SIGTERM` da navbat bo'shatiladi (5 soniya, `SUPABASE_DRAIN_MS`).

`updateGuildSettings` sinxron qolgani uchun **hech bir chaqiruvchi kod
o'zgartirilmadi**.

`src/config/storage.js` · commit `2bbc069`

---

### B1 — Hamma narsa bitta jsonb blobda edi 🔴

**Muammo.** Har server uchun bitta qator: `guild_settings(guild_id, data jsonb)`.
Sozlamalar, warnlar, XP, kunlik faollik, team arxivi — hammasi bitta obyektda.
Demak bitta odam XP olsa, **butun server** qayta yozilardi: barcha warnlar,
barcha boshqa a'zolarning darajasi, team arxivi. Bir necha yuz a'zoli serverda
bu har chat xabari uchun katta yuk.

**Yechim.** Issiq (tez-tez o'zgaradigan) bo'limlar alohida jadvallarga
chiqarildi:

| Jadval | Mazmuni |
|---|---|
| `guild_levels` | Har a'zo uchun 1 qator (xp, level, messages) |
| `guild_activity` | Har a'zo uchun 1 qator (kunlik ovoz/xabar hisobi) |
| `guild_warns` | Har ogohlantirish uchun 1 qator |
| `guild_settings` | Faqat sovuq konfiguratsiya |

**Muhim qaror:** xotiradagi shakl **atayin o'zgartirilmadi**. Shuning uchun
o'qish hamon `memoryCache` dan O(1) va **birorta chaqiruvchi kod
o'zgartirilmadi**. Faqat yozish "donadorligi" o'zgardi — endi XP tik bitta
kichik qator yozadi.

**Ko'chirish avtomatik.** `init()` jadvallardan o'qib xotiraga joylaydi,
blobda qolgan eski ma'lumotni navbatga qo'yadi va blobni ularsiz qayta yozadi.
Takroran ishga tushirsa ham xavfsiz (idempotent).

**Jadvallar majburiy emas.** `init()` har birini tekshiradi; README dagi SQL
ishga tushirilmagan bo'lsa, o'sha ma'lumot eski usulda blobda saqlanaveradi va
bot qaysi rejimda ekani konsolda hamda `/health` da ko'rinadi
(`getSupabaseStatus().splitTables`).

> ⚠️ **Yangi qoida.** Issiq ma'lumotni endi faqat storage mutatorlari orqali
> o'zgartirish kerak (`addXP`, `updateMemberActivity`, `addWarn`,
> `removeUserWarn`, `clearUserWarns`). `getGuildSettings()` qaytargan obyektni
> to'g'ridan-to'g'ri o'zgartirish xotirada ishlaydi, lekin **saqlanmaydi**.
> Hozirgi kodda hech qayerda bunday qilinmagan (tekshirildi).

**Kerakli SQL:** README.md, "Supabase Bazasini Ulash" bo'limi, 3-qadam.

`src/config/storage.js`, `README.md` · commit `30b5fa1`

---

### QW4 — `ephemeral: true` eskirgan (53 ta joy)

**Muammo.** discord.js v14.14+ da `ephemeral` eskirgan. Kodda `MessageFlags`
allaqachon ishlatilgan — migratsiya yarim qolgan edi.

**Yechim.** 53 ta joyda `{ ephemeral: true }` → `{ flags: MessageFlags.Ephemeral }`,
20 ta faylga `MessageFlags` importi qo'shildi.

---

### QW5 — `dynamic: true` eskirgan (30 ta joy)

**Muammo.** `displayAvatarURL({ dynamic: true })` — v14 da bu parametr hech
narsa qilmaydi (animatsiya standart holatda yoqilgan).

**Yechim.** 30 ta joydan olib tashlandi, yondosh `size` parametri saqlandi.

---

### QW6 — Issiq funksiyalar ichida `require()`

**Muammo.** `interactionCreate.js` — har tugma bosilganda 5 ta `require`.
`messageCreate.js` — har xabarda. `voiceStateUpdate.js`, `guildMemberAdd.js`,
`tempVoiceManager.js` — shu kabi.

**Yechim.** Avval butun `src/` bo'yicha aylanma bog'liqlik tekshirildi —
**yo'q ekan**, shuning uchun hammasi fayl boshiga ko'chirildi. `index.js` va
`deploy-commands.js` dagi dinamik yuklovchi `require` lar o'z joyida qoldi.

---

### QW7 — `messageCreate` da ruxsatlar 2 marta hisoblanardi

**Muammo.** Anti-link va media-roles bloklari bir xil `isOwner` / `isStaff`
hisobini takrorlardi — har xabarda 6 ta ruxsat tekshiruvi va
`process.env.OWNER_ID.trim()` 2 marta.

**Yechim.** Bitta `isExempt(message)` yordamchisi, xabar boshida bir marta.
`OWNER_ID` modul yuklanganda keshlanadi.

**Natija:** har xabarda 6 → 3 ta ruxsat tekshiruvi, `process.env` umuman
o'qilmaydi (testda o'lchandi).

---

### QW9 — Intervallar bir vaqtda hamma serverga urilardi

**Muammo.** `ready.js` dagi 10 daqiqalik interval barcha serverlarni bitta
tikda aylanardi — ko'p serverli botda hammasi bir vaqtda REST so'rov
yuborardi.

**Yechim.** `sweepGuildStats()` serverlarni 300 ms siljish bilan navbatga
qo'yadi (10 server = 3 soniyaga yoyiladi).

---

### B4 — Ovozli sessiyalar deployda yo'qolardi

**Muammo.** `voiceSessions` Map faqat xotirada edi. Render har deployda uni
o'chiradi, shuning uchun ayni paytda ovozli xonada o'tirgan odamning vaqti
butunlay yo'qolardi va kunlik faollik hisobi kam chiqardi. Bundan tashqari
a'zo serverdan chiqsa yozuv tozalanmasdi — sekin "oqish".

**Yechim.** `guild_activity` ga `voice_session_start` ustuni qo'shildi.
Xonaga kirilganda yoziladi, chiqilganda `null` ga qaytadi. Map endi faqat
tez kesh — haqiqiy manba diskda.

`ready` da `restoreVoiceSessions()` ishga tushadi:
- A'zo hali ham ovozda bo'lsa → sessiya davom etadi (deploy vaqti
  yo'qolmaydi).
- A'zo allaqachon chiqib ketgan bo'lsa → qachon chiqqani noma'lum, shuning
  uchun sessiya **hisoblanmasdan** yopiladi. Bu ataylab: yo'q vaqtni to'qib
  chiqarmaslik uchun.

`guildMemberRemove` da `forgetMember()` keshni tozalaydi.

**SQL:** README dagi `guild_activity` jadvaliga yangi ustun. Jadval
oldinroq yaratilgan bo'lsa:
```sql
alter table guild_activity add column if not exists voice_session_start bigint;
```

`src/utils/activityTracker.js`, `src/config/storage.js`,
`src/events/ready.js`, `src/events/guildMemberRemove.js`

---

### B6 — 105 ta `console.*`, darajali logger yo'q edi

**Muammo.** Log chiqishini o'chirib ham, kamaytirib ham bo'lmasdi. Prod da
shovqin ko'p, kerak bo'lganda esa batafsil ma'lumot yo'q.

**Nega to'xtab turgan edi:** konsol chiqishi ayni paytda Render paneli uchun
interfeys vazifasini bajaradi (`storage.init()` dagi `====` ramkalari) -
ularni o'chirib bo'lmaydi.

**Yechim.** `src/utils/log.js` — `LOG_LEVEL` ni hisobga oladigan yupqa
o'ramchi:

| Daraja | Ko'rinadi |
|---|---|
| `debug` | hammasi |
| `info` (standart) | info, warn, error |
| `warn` | warn, error |
| `error` | faqat error |
| `silent` | hech narsa |

`log.banner()` esa **har doim** chiqadi — ishga tushish holati bloklari shu
orqali beriladi, shuning uchun `LOG_LEVEL=silent` da ham Supabase holati
ko'rinaveradi (testda tekshirildi).

113 ta `console.*` chaqiruvi 34 ta faylda almashtirildi. Buyruq yuklash
qatorlari (`[BUYRUQ YUKLANDI]`) `debug` ga tushirildi — ular 30+ qator
shovqin edi.

Noto'g'ri `LOG_LEVEL` berilsa ogohlantirib `info` ga qaytadi.

`src/utils/log.js` (yangi) + 34 ta fayl

---

### B5 — Buyruqlar uchun umumiy qatlam yo'q edi

**Muammo.** Buyruqlar oddiy `{ data, execute }` obyektlari edi. Cooldown
yo'q, vaqt o'lchash yo'q, metrika yo'q. `interactionCreate` dagi try/catch —
yagona umumiy joy.

**Yechim.** `src/utils/commandRunner.js` — `runCommand()` zanjiri:
cooldown → bajarish → vaqt o'lchash → xatolik.

- Buyruq faylida ixtiyoriy `cooldown: <soniya>` e'lon qilish mumkin;
  `COMMAND_COOLDOWN` ENV orqali umumiy standart ham beriladi.
- Cooldown **har foydalanuvchi uchun alohida**, global emas.
- Bajarilmagan (xato bergan) buyruq cooldown ni sarflamaydi — foydalanuvchi
  darhol qayta urinishi mumkin.
- `SLOW_COMMAND_MS` (standart 3000) dan uzoq davom etgan buyruq `warn`
  bilan belgilanadi, qolganlari `debug` ga yoziladi.

**Buyruq fayllari umuman o'zgartirilmadi** — zanjir `interactionCreate`
ichida o'raladi.

`src/utils/commandRunner.js` (yangi), `src/events/interactionCreate.js`

---

### QW11 — `index.js` ichida 260 qator HTML edi

**Muammo.** `index.js` 347 qator edi, shundan ~260 tasi `/`, `/guide`,
`/terms`, `/privacy` sahifalarining HTML shablonlari. Har so'rovda
qaytadan yig'ilardi. Sahifani tahrirlash uchun JS fayl ichidagi shablon
satrni tahrirlash kerak edi.

**Yechim.**
- HTML alohida fayllarda: `src/web/pages/{status,guide,terms,privacy}.html`
- `src/web/index.js` — `createWebServer(client, storage)`
- Sahifalar **bir marta**, bot yoqilganda o'qiladi (testda tasdiqlandi:
  so'rovlar paytida diskka umuman murojaat yo'q)
- Statik sahifalar o'sha zahoti gzip qilinadi

**Qo'shimcha paket kerak emas.** `compression` o'rniga Node ning o'z `zlib`
i ishlatildi — sahifalar statik va keshlangani uchun ularni bir marta siqib
qo'yish yetarli, har so'rovda qayta siqishning hojati yo'q.

| Sahifa | Oddiy | Gzip |
|---|---|---|
| guide | 7977 | 2893 |
| terms | 1643 | 893 |
| privacy | 1599 | 873 |
| **jami** | **11219** | **4659** (58% kamroq) |

`/` sahifasi dinamik bo'lgani uchun shablon keshdan olinadi, qiymatlar
(`{{botTag}}`, `{{guildCount}}` va h.k.) har so'rovda qo'yiladi.

**Natija:** `index.js` 347 → 93 qator.

`src/web/` (yangi), `src/index.js`

---

## ⬜ QOLGAN ISHLAR

Optimizatsiya bandlarining hammasi bajarildi. Quyidagi ikki band — kod emas,
**qaror** talab qiladi (pastdagi "Xavfsizlik eslatmalari" bo'limiga qarang).

---

## 🔒 Xavfsizlik eslatmalari (optimizatsiyaga aloqasi yo'q)

### 1. `service_role` kaliti va o'chirilgan RLS

`storage.js:17` `SUPABASE_SERVICE_ROLE_KEY` ni qabul qiladi, RLS xatosi
ishlovchisi esa operatorga to'g'ridan-to'g'ri
`ALTER TABLE guild_settings DISABLE ROW LEVEL SECURITY;` qilishni yoki
`service_role` kalitiga o'tishni maslahat beradi. README ham shuni takrorlaydi.

`service_role` RLS ni butunlay chetlab o'tadi — ishonchli backend uchun bu
normal, lekin ENV o'zgaruvchisi sizib chiqsa, bu **butun bazaga to'liq
kirish** degani. RLS ni o'chirish esa himoyaning yana bir qatlamini olib
tashlaydi.

Bu ogohlantirish xabarining standart maslahati emas, **ongli qaror** bo'lishi
kerak.

### 2. PRIVACY.md va cross-server logging bir-biriga zid

`PRIVACY.md` da log ma'lumotlari "tashqi serverlarga berilmaydi" deyilgan.
Ammo cross-server logging imkoniyati (`logger.js:24-26`, `:32-37`) loglarni
ataylab **ikkinchi Discord serveriga** uzatadi.

Matn va amaldagi xatti-harakat mos kelmaydi — biri tuzatilishi kerak.

---

## 🧪 Tekshiruv haqida

Har bir tuzatish uchun test to'plami yozildi va bajarildi:

| To'plam | Tekshiruvlar | Natija |
|---|---|---|
| `test-storage` | 17 ta | ✅ |
| `test-supabase-queue` | 13 ta | ✅ |
| `test-qw23` | 15 ta | ✅ |
| `test-b1` | 19 ta | ✅ |
| `test-qw7` | 8 ta | ✅ |
| `test-b4` | 9 ta | ✅ |
| `test-b6` | 13 ta | ✅ |
| `test-b5` | 11 ta | ✅ |
| `test-qw11` | 13 ta | ✅ |

> ⚠️ **Muhim cheklov.** Loyihada `node_modules` o'rnatilmagan, shuning uchun
> barcha testlar **soxta (stub)** `discord.js` va **soxta** Supabase mijozi
> bilan ishlatildi. Mantiq, yozish donadorligi, migratsiya va zaxira
> rejimlari tekshirildi — lekin haqiqiy Postgres yoki haqiqiy Discord
> gateway bilan **hech narsa sinovdan o'tkazilmadi**.
>
> Deploydan oldin `npm install` qilib, alohida (test) Supabase loyihasiga
> ulanib botni ishga tushirish kerak. Ayniqsa README dagi SQL ustun turlari
> mijoz yuborayotgan qiymatlarga mos kelishini tekshirish lozim:
> `last_xp` va `today_voice_ms` — `bigint`, sanalar — `text`.

Bundan tashqari `src/` dagi 63 ta modul stub bilan yuklab ko'rildi —
ko'chirilgan `require` lar hech qayerda aniqlanmagan havola qoldirmagani shu
bilan tasdiqlandi.

Testlar vaqtinchalik papkada (scratchpad) yozilgan va repoga qo'shilmagan.
Doimiy saqlash kerak bo'lsa — `test/` papkasiga ko'chirish mumkin.

---

## Tavsiya etilgan keyingi tartib

Optimizatsiya ishlari tugadi. Qolgan ikki band sizning qaroringizni talab
qiladi:

1. **RLS / `service_role`** — hozirgi yondashuvni ongli ravishda tasdiqlash
   yoki RLS ni yoqib, botga alohida policy yozish.
2. **PRIVACY.md va cross-server logging** — matnni amaldagi xatti-harakatga
   moslashtirish yoki funksiyani cheklash.

Shundan keyin: `npm install` qilib, alohida test Supabase loyihasida
to'liq ishga tushirib ko'rish.
