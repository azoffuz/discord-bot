require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');
const express = require('express');
const fs = require('fs');
const path = require('path');
const deployCommands = require('./deploy-commands');
const storage = require('./config/storage');

// 1. DISCORD BOT CLIENTINI SOZLASH
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers, // Yangi a'zo va rollar uchun (Developer Portal da yoqilishi shart)
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // Xabar loglari uchun (Developer Portal da yoqilishi shart)
    GatewayIntentBits.GuildVoiceStates, // Ovozli kanal loglari
    GatewayIntentBits.GuildModeration // Ban va jazo loglari
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.GuildMember,
    Partials.User
  ]
});

client.commands = new Collection();

// 2. BUYRUQLARNI YUKLASH (Commands Loader)
const commandsPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(commandsPath);

for (const folder of commandFolders) {
  const folderPath = path.join(commandsPath, folder);
  if (!fs.statSync(folderPath).isDirectory()) continue;

  const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
  for (const file of commandFiles) {
    const filePath = path.join(folderPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
      client.commands.set(command.data.name, command);
      console.log(`[BUYRUQ YUKLANDI] /${command.data.name}`);
    }
  }
}

// 3. HODISALARNI YUKLASH (Events Loader)
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file);
  const event = require(filePath);
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
  }
  console.log(`[HODISA YUKLANDI] ${event.name}`);
}

// 4. RENDER.COM UCHUN EXPRESS WEB SERVER (24/7 Keep-Alive & Health Check)
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  const status = client.isReady() ? 'Faol (Online)' : 'Ishga tushmoqda...';
  const sbStatus = storage.getSupabaseStatus();

  const sbBadge = sbStatus.connected
    ? '<span class="badge" style="background: #22c55e; color: #052e16;">● SUPABASE: ULANGAN</span>'
    : '<span class="badge" style="background: #ef4444; color: #ffffff;">○ SUPABASE: ULANMAGAN (Lokal)</span>';

  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Cleva - Discord Bot Status</title>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          .card { background: #1e293b; padding: 2.5rem 3rem; border-radius: 14px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); text-align: center; border: 1px solid #334155; max-width: 460px; }
          .badge { display: inline-block; padding: 0.35rem 0.9rem; border-radius: 9999px; font-weight: bold; font-size: 0.85rem; margin: 0.3rem 0.2rem; }
          .badge-server { background: #38bdf8; color: #082f49; }
          h1 { margin: 0.8rem 0 0.5rem; color: #38bdf8; }
          p { color: #94a3b8; margin: 0.5rem 0; font-size: 0.95rem; }
          .db-box { margin-top: 1.2rem; padding: 0.8rem; background: #0f172a; border-radius: 8px; border: 1px solid #334155; font-size: 0.85rem; color: #cbd5e1; }
        </style>
      </head>
      <body>
        <div class="card">
          <div>
            <span class="badge badge-server">● 24/7 SERVER ONLINE</span>
            ${sbBadge}
          </div>
          <h1>🤖 Cleva — Discord Bot</h1>
          <p>Bot holati: <strong style="color: #4ade80;">${status}</strong></p>
          <p>Bot nomi: <strong>${client.user ? client.user.tag : 'Cleva'}</strong></p>
          <p>Serverlar soni: <strong>${client.guilds?.cache.size || 0}</strong></p>
          <div class="db-box">
            <strong>Baza holati:</strong> ${sbStatus.message}
          </div>
          <div style="margin-top: 1.5rem; display: flex; gap: 0.8rem; justify-content: center; flex-wrap: wrap;">
            <a href="${process.env.SERVER_INVITE_URL || 'https://discord.gg/fwVyfrtP4h'}" target="_blank" style="background: #5865F2; color: #ffffff; padding: 0.5rem 1rem; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 0.9rem;">👑 Serverga Qo'shilish</a>
            <a href="/guide" style="background: #38bdf8; color: #082f49; padding: 0.5rem 1rem; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 0.9rem;">📖 To'liq Qo'llanma (Guide)</a>
            <a href="/terms" style="background: #334155; color: #f8fafc; padding: 0.5rem 1rem; border-radius: 6px; text-decoration: none; font-size: 0.9rem;">Terms</a>
            <a href="/privacy" style="background: #334155; color: #f8fafc; padding: 0.5rem 1rem; border-radius: 6px; text-decoration: none; font-size: 0.9rem;">Privacy</a>
          </div>
        </div>
      </body>
    </html>
  `);
});

app.get('/guide', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Cleva Bot — To'liq Foydalanish Qo'llanmasi</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0b0f19; color: #e2e8f0; line-height: 1.7; padding: 2rem 1rem; margin: 0; }
          .container { max-width: 900px; margin: 0 auto; background: #151d30; padding: 2.5rem; border-radius: 14px; border: 1px solid #1e293b; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
          h1 { color: #38bdf8; border-bottom: 2px solid #38bdf8; padding-bottom: 0.5rem; font-size: 2rem; margin-top: 0; }
          h2 { color: #818cf8; margin-top: 2rem; border-bottom: 1px solid #334155; padding-bottom: 0.3rem; }
          h3 { color: #38bdf8; margin-top: 1.2rem; }
          code { background: #0f172a; color: #38bdf8; padding: 0.2rem 0.4rem; border-radius: 4px; font-family: monospace; }
          pre { background: #0f172a; padding: 1rem; border-radius: 8px; border: 1px solid #334155; overflow-x: auto; color: #a5f3fc; }
          .cmd-box { background: #0f172a; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; border-left: 4px solid #38bdf8; }
          .alert { background: #1e1b4b; border-left: 4px solid #a855f7; padding: 1rem; border-radius: 6px; margin: 1rem 0; }
          .security-box { background: #450a0a; border-left: 4px solid #ef4444; padding: 1rem; border-radius: 6px; margin: 1rem 0; }
          a { color: #38bdf8; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🤖 Cleva — Mukammal Foydalanish Qo'llanmasi</h1>
          <p>Ushbu sahifada Cleva botining barcha tizimlari, buyruqlari, sozlamalari va server xavfsizligi bo'yicha to'liq ma'lumotlar jamlangan.</p>

          <h2>🛡️ 1. Moderatsiya va Xavfsizlik</h2>
          <div class="cmd-box">
            <h3>/give-role & /remove-role-from</h3>
            <p><code>/give-role user:@foydalanuvchi role:@Rol</code> — Foydalanuvchiga belgilangan rolni beradi.</p>
            <p><code>/remove-role-from remove_role:@EskiRol having_role:@YangiRol</code> — 2-rolga ega barcha odamlardan 1-rolni bittada olib tashlaydi.</p>
          </div>

          <div class="cmd-box">
            <h3>/mute & /unmute</h3>
            <p><code>/mute user:@foydalanuvchi duration:10m reason:Sabab</code> — Vaqtinchalik ovozini o'chirish (Timeout: 60s, 10m, 1h, 1d, 7d).</p>
            <p><code>/unmute user:@foydalanuvchi</code> — Jazoni bekor qilish.</p>
          </div>

          <div class="cmd-box">
            <h3>/warns & /del-warn</h3>
            <p><code>/del-warn user:@foydalanuvchi reason:Qoidabuzarlik</code> — Xabarni o'chiradi va ogohlantirish (warn) yozadi.</p>
            <p><code>/warns list user:@foydalanuvchi</code> — Foydalanuvchining barcha warnlari ro'yxatini ko'rish.</p>
            <p><code>/warns remove user:@foydalanuvchi warn_id:[ID]</code> — Bitta warnni o'chirish.</p>
            <p><code>/warns clear user:@foydalanuvchi</code> — Barcha warnlarini tozalash.</p>
          </div>

          <div class="cmd-box">
            <h3>/lock & /unlock</h3>
            <p><code>/lock channel:#kanal reason:Janjal</code> — Kanalni oddiy a'zolar uchun yozishdan yopib qo'yadi.</p>
            <p><code>/unlock channel:#kanal</code> — Kanalni yana hammaga ochib beradi.</p>
          </div>

          <div class="cmd-box">
            <h3>/clear</h3>
            <p><code>/clear count:50 user:@foydalanuvchi</code> — Chatdagi xabarlarni ommaviy tozalash (1-100 ta).</p>
          </div>

          <h2>⚙️ 2. Avtomatlashtirilgan Tizimlar</h2>
          <div class="cmd-box">
            <h3>1. Kategoriyalangan Log Tizimi (/set-log)</h3>
            <p><code>/set-log category:[Kategoriya]</code> buyrug'ini bering. Bot tanlangan kategoriya ichida avtomatik 5 ta yopiq kanal ochadi:</p>
            <ul>
              <li><code>#xabar-loglari</code> — Xabarlar o'chishi va tahrirlanishi</li>
              <li><code>#azo-loglari</code> — A'zolar kirishi, chiqishi va profil o'zgarishlari</li>
              <li><code>#moderatsiya-loglari</code> — Mute, warn, lock, ban loglari</li>
              <li><code>#ticket-loglari</code> — Ticket ochilishi, yopilishi va transcriptlar</li>
              <li><code>#ovozli-loglar</code> — Ovozli kanallar harakatlari</li>
            </ul>
          </div>

          <div class="cmd-box">
            <h3>2. Ticket (Murojaat & Rol Olish) Tizimi (/set-ticket)</h3>
            <p><code>/set-ticket channel:#tickets category:[Kategoriya] support_role:@Moderator</code></p>
            <p>Asosiy kanalda tugmali panel chiqadi. A'zo tugmani bossa, shaxsiy kanal ochiladi va unga rol olish anketasi yuboriladi. Ticket yopilganda barcha yozishmalar <code>.txt</code> transcript qilinib logga saqlanadi!</p>
          </div>

          <div class="cmd-box">
            <h3>3. Auto-Role Tizimi (/set-autorole)</h3>
            <p><code>/set-autorole role:@Azo</code> — Serverga yangi kirgan a'zolarga darhol ushbu rol avtomatik beriladi.</p>
          </div>

          <div class="cmd-box">
            <h3>4. Anti-Link (Reklamadan Himoya) (/set-antilink)</h3>
            <p>Standart holatda yoqilgan. <code>/set-antilink status:True</code> yoki <code>False</code> orqali boshqariladi. Begona Discord linklari va veb-sayt havolalarini avtomatik o'chiradi.</p>
          </div>

          <div class="cmd-box">
            <h3>5. Server Statistikasi (/set-stats)</h3>
            <p><code>/set-stats status:Yoqish</code> yoki <code>O'chirish</code></p>
            <p>Serverning yuqorisida qulflangan ovozli hisoblagich kanallari (Jami a'zolar, Odamlar, Botlar) kategoriyasini avtomat yaratadi va har 10 daqiqada yangilab turadi.</p>
          </div>

          <div class="cmd-box">
            <h3>6. Avtomatik Shaxsiy Ovozli Xonalar (/set-tempvoice)</h3>
            <p><code>/set-tempvoice status:Yoqish</code> yoki <code>O'chirish</code></p>
            <p>"➕ Xona Yaratish" nomli kanal ochiladi. Foydalanuvchi unga kirishi bilan bot unga shaxsiy kanal ochib beradi va uni avtomatik ko'chiradi. Hamma chiqib ketgach kanal o'zi o'chadi.</p>
          </div>

          <div class="cmd-box">
            <h3>7. Level & XP Tizimi (/set-level, /rank, /leaderboard)</h3>
            <p><code>/set-level status:Yoqish [channel]</code> — Chatda yozganlik uchun tajriba (XP) to'plash tizimini yoqadi (Standart holatda o'chirilgan).</p>
            <p><code>/rank [user]</code> — Foydalanuvchining darajasi, XP, serverdagi o'rni va foizli progress barini ko'rsatadi.</p>
            <p><code>/leaderboard</code> — Serverdagi eng faol 10 nafar a'zo reytingini ko'rsatadi.</p>
          </div>

          <h2>📢 3. E'lonlar va So'rovnomalar</h2>
          <div class="cmd-box">
            <p><code>/say message:Salom channel:#kanal</code> — Bot nomidan oddiy xabar yuborish.</p>
            <p><code>/embed title:E'lon description:Matn... color:#5865F2 image:URL</code> — Ramkali rasmiy e'lon.</p>
            <p><code>/poll question:Savol option1:Variant1 option2:Variant2</code> — Emojilar bilan ovoz berish so'rovnomasi.</p>
          </div>

          <div class="security-box">
            <h2>🔒 4. Muhim Xavfsizlik Qoidalari</h2>
            <ol>
              <li><strong>Rol Ierarxiyasi:</strong> Server Sozlamalari -> Rollar bo'limida Cleva botining rolini oddiy a'zolar va moderatorlar rollaridan yuqoriga qo'ying, lekin server egasi rolidan pastda tursin.</li>
              <li><strong>Yagona Server Rejimi:</strong> Render ENV ga <code>ALLOWED_GUILD_ID</code> kiritilgani sababli, bot begona serverlarga qo'shilsa darhol o'zi chiqib ketadi.</li>
              <li><strong>Asosiy Admin:</strong> Render ENV ga <code>OWNER_ID</code> kiritilgani sababli, faqat siz mutlaq boshqaruv huquqiga egasiz.</li>
              <li><strong>Token Xavfsizligi:</strong> Bot tokeningiz hech qachon GitHub ga tushmaydi (.gitignore orqali himoyalangan).</li>
            </ol>
          </div>

          <p style="text-align: center; margin-top: 2rem;"><a href="/">← Bosh sahifaga qaytish</a></p>
        </div>
      </body>
    </html>
  `);
});

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    bot: 'Cleva',
    uptime: process.uptime(),
    supabase: storage.getSupabaseStatus()
  });
});

app.get('/terms', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Terms of Service - Cleva Discord Bot</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #e2e8f0; line-height: 1.6; padding: 2rem; max-width: 800px; margin: 0 auto; }
          h1 { color: #38bdf8; border-bottom: 1px solid #334155; padding-bottom: 0.5rem; }
          h2 { color: #818cf8; margin-top: 1.5rem; }
          a { color: #38bdf8; text-decoration: none; }
          .card { background: #1e293b; padding: 2rem; border-radius: 12px; border: 1px solid #334155; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>Terms of Service (Foydalanish Shartlari) — Cleva</h1>
          <p><em>Oxirgi yangilanish: 2026-yil 13-sentyabr</em></p>
          <h2>1. Xizmatdan foydalanish</h2>
          <p>Cleva Discord boti server boshqaruvi, moderatsiya, ticket tizimi va a'zolar qulayligi uchun xizmat qiladi. Botdan noqonuniy harakatlar, spam tarqatish yoki Discord qoidalarini buzish maqsadida foydalanish taqiqlanadi.</p>
          <h2>2. Mas'uliyat</h2>
          <p>Server ma'murlari Cleva botiga taqdim etgan huquq va ruxsatlar doirasida amalga oshirilgan harakatlar uchun to'liq javobgardirlar.</p>
          <h2>3. Xizmat kafolatlari</h2>
          <p>Cleva boti "bor holatida" (as-is) taqdim etiladi. Uzilishlar yoki hosting cheklovlari uchun dasturchilar moddiy javobgar emas.</p>
          <p><a href="/">← Bosh sahifaga qaytish</a> | <a href="/privacy">Privacy Policy</a></p>
        </div>
      </body>
    </html>
  `);
});

app.get('/privacy', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Privacy Policy - Cleva Discord Bot</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #e2e8f0; line-height: 1.6; padding: 2rem; max-width: 800px; margin: 0 auto; }
          h1 { color: #38bdf8; border-bottom: 1px solid #334155; padding-bottom: 0.5rem; }
          h2 { color: #818cf8; margin-top: 1.5rem; }
          a { color: #38bdf8; text-decoration: none; }
          .card { background: #1e293b; padding: 2rem; border-radius: 12px; border: 1px solid #334155; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>Privacy Policy (Maxfiylik Siyosati)</h1>
          <p><em>Oxirgi yangilanish: 2026-yil 13-sentyabr</em></p>
          <h2>1. Saqlanadigan ma'lumotlar</h2>
          <p>Bot faqat o'z funksiyalari uchun kerakli ma'lumotlarni saqlaydi: Server ID, log va welcome kanallari ID si, welcome xabari shabloni hamda moderatsiya ogohlantirishlari (Warns).</p>
          <h2>2. Ma'lumotlar xavfsizligi</h2>
          <p>Shaxsiy ma'lumotlar uchinchi shaxslarga sotilmaydi, berilmaydi yoki noqonuniy maqsadlarda foydalanilmaydi.</p>
          <h2>3. Ma'lumotlarni o'chirish</h2>
          <p>Botni serverdan chiqarish orqali foydalanishni to'xtatishingiz mumkin. Ma'lumotlarni to'liq tozalash uchun dasturchiga murojaat qilish yetarli.</p>
          <p><a href="/">← Bosh sahifaga qaytish</a> | <a href="/terms">Terms of Service</a></p>
        </div>
      </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log(`🌐 Express web-server ${PORT}-portda ishga tushdi (Render.com uchun tayyor).`);
});

// 5. BAZANI TIKLASH VA DISCORD GA ULANISH
async function startBot() {
  await storage.init();

  const token = process.env.DISCORD_TOKEN;

  if (!token || token === 'your_bot_token_here') {
    console.warn('⚠️ DIQQAT: .env faylida DISCORD_TOKEN belgilanmagan! Bot ulanmadi, lekin Web Server faol turibdi.');
  } else {
    // Buyruqlarni avtomatik ro'yxatdan o'tkazish
    if (process.env.AUTO_DEPLOY !== 'false') {
      deployCommands().catch(err => console.error('Avto-deploy xatosi:', err));
    }

    client.login(token).catch(err => {
      console.error('❌ Bot tizimga kira olmadi (Login Error):', err.message);
    });
  }
}

startBot();
