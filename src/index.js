require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const deployCommands = require('./deploy-commands');
const storage = require('./config/storage');
const { createWebServer } = require('./web');
const log = require('./utils/log');

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
      log.debug(`[BUYRUQ YUKLANDI] /${command.data.name}`);
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
  log.debug(`[HODISA YUKLANDI] ${event.name}`);
}

// 4. RENDER.COM UCHUN EXPRESS WEB SERVER (24/7 Keep-Alive & Health Check)
// Sahifalar src/web/pages/*.html da; bir marta o'qilib keshlanadi.
const PORT = process.env.PORT || 3000;
const app = createWebServer(client, storage);

app.listen(PORT, () => {
  log.banner(`🌐 Express web-server ${PORT}-portda ishga tushdi (Render.com uchun tayyor).`);
});

// 5. BAZANI TIKLASH VA DISCORD GA ULANISH
async function startBot() {
  await storage.init();

  const token = process.env.DISCORD_TOKEN;

  if (!token || token === 'your_bot_token_here') {
    log.warn('⚠️ DIQQAT: .env faylida DISCORD_TOKEN belgilanmagan! Bot ulanmadi, lekin Web Server faol turibdi.');
  } else {
    // Buyruqlarni avtomatik ro'yxatdan o'tkazish
    if (process.env.AUTO_DEPLOY !== 'false') {
      deployCommands().catch(err => log.error('Avto-deploy xatosi:', err));
    }

    client.login(token).catch(err => {
      log.error('❌ Bot tizimga kira olmadi (Login Error):', err.message);
    });
  }
}

startBot();
