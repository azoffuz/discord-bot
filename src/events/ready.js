const { ActivityType, Routes, Events } = require('discord.js');

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    const inviteLink = process.env.SERVER_INVITE_URL || 'https://discord.gg/fwVyfrtP4h';

    console.log(`========================================`);
    console.log(`🤖 Cleva boti muvaffaqiyatli ishga tushdi: ${client.user.tag}`);
    console.log(`🌐 Serverlar soni: ${client.guilds.cache.size}`);
    console.log(`🔗 Asosiy server havolasi: ${inviteLink}`);
    console.log(`========================================`);

    // 1. Bot statusi (Presence - ismning pastida ko'rinadi)
    client.user.setPresence({
      activities: [
        {
          name: 'custom',
          type: ActivityType.Custom,
          state: `🔗 Serverimiz: ${inviteLink}`
        }
      ],
      status: 'online'
    });

    // 2. Botning rasmiy profil tavsifini (About Me / Bio) avtomatik yangilash
    try {
      await client.rest.patch(Routes.currentApplication(), {
        body: {
          description: `🤖 Cleva — Server nazorati, moderatsiya, ticket tizimi va ko'p funksiyali yordamchi bot!\n\n👑 Bizning rasmiy serverimizga qo'shiling:\n👉 ${inviteLink}`
        }
      }).catch(err => {
        console.log('Bio yangilash (ixtiyoriy):', err.message);
      });
    } catch (e) {
      // Ignorlash
    }

    // 3. Server statistikasini har 10 daqiqada yangilab turish
    const { updateGuildStats } = require('../utils/statsUpdater');
    // Bot yoqilganda 5 soniyadan keyin bir marta tekshirish
    setTimeout(() => {
      client.guilds.cache.forEach(guild => updateGuildStats(guild));
    }, 5000);

    // Har 10 daqiqada yangilash (Rate limitga tushmaslik uchun)
    setInterval(() => {
      client.guilds.cache.forEach(guild => updateGuildStats(guild));
    }, 10 * 60 * 1000);

    // 4. YouTube kanallari yangi videolarini avtomatik tekshirib borish
    const { initYouTubeNotifier } = require('../utils/youtubeNotifier');
    initYouTubeNotifier(client);

    // 5. Kunlik faollik rolini tekshirish va kirmaganlardan olib tashlash (har 15 daqiqada)
    const { evaluateDailyInactivity } = require('../utils/activityTracker');
    setTimeout(() => {
      evaluateDailyInactivity(client).catch(err => console.error('[ACTIVE EVAL ERROR]:', err.message));
    }, 15000);

    setInterval(() => {
      evaluateDailyInactivity(client).catch(err => console.error('[ACTIVE EVAL ERROR]:', err.message));
    }, 15 * 60 * 1000);
  }
};
