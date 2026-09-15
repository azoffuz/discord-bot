require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

async function deployCommands() {
  const commands = [];
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
        commands.push(command.data.toJSON());
      } else {
        console.warn(`[OGOHLANTIRISH] ${filePath} faylida 'data' yoki 'execute' xossasi yetishmaydi.`);
      }
    }
  }

  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.CLIENT_ID;
  const guildId = process.env.ALLOWED_GUILD_ID || process.env.GUILD_ID;

  if (!token || !clientId) {
    console.error('❌ Xatolik: DISCORD_TOKEN yoki CLIENT_ID o\'zgaruvchilari kiritilmagan!');
    return false;
  }

  const rest = new REST().setToken(token);

  try {
    console.log(`⏳ ${commands.length} ta slash buyruq Discord API ga ro'yxatdan o'tkazilmoqda...`);

    const rawAllowed = process.env.ALLOWED_GUILD_ID || process.env.GUILD_ID || '';
    const allowedGuilds = rawAllowed
      .split(',')
      .map(id => id.trim())
      .filter(Boolean);

    if (allowedGuilds.length > 0) {
      // Dublikatlarni (2 tadan bo'lib qolishini) yo'qotish uchun global buyruqlarni tozalaymiz
      console.log('🧹 Dublikat bo\'lmasligi uchun eski global buyruqlar tozalanmoqda...');
      await rest.put(Routes.applicationCommands(clientId), { body: [] }).catch(err => {
        console.warn('Global buyruqlarni tozalashda ogohlantirish:', err.message);
      });

      // Har bir ruxsat berilgan server uchun buyruqlarni ro'yxatdan o'tkazish
      for (const gId of allowedGuilds) {
        const data = await rest.put(
          Routes.applicationGuildCommands(clientId, gId),
          { body: commands }
        );
        console.log(`✅ ${data.length} ta buyruq server (${gId}) uchun ro'yxatdan o'tdi (dublikatlar olib tashlandi)!`);
      }
    } else {
      // Global ro'yxatdan o'tkazish (barcha serverlar uchun)
      const data = await rest.put(
        Routes.applicationCommands(clientId),
        { body: commands }
      );
      console.log(`✅ ${data.length} ta buyruq global (barcha serverlar) uchun ro'yxatdan o'tdi!`);
    }

    return true;
  } catch (error) {
    console.error('❌ Buyruqlarni ro\'yxatdan o\'tkazishda xatolik:', error);
    return false;
  }
}

if (require.main === module) {
  deployCommands();
}

module.exports = deployCommands;
