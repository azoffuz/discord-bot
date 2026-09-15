const { ActivityType, Routes, Events } = require('discord.js');
const { updateGuildStats } = require('../utils/statsUpdater');
const { initYouTubeNotifier } = require('../utils/youtubeNotifier');
const { evaluateDailyInactivity, restoreVoiceSessions } = require('../utils/activityTracker');
const log = require('../utils/log');

// Serverlar orasidagi siljish - 10 ta server = 3 soniyaga yoyiladi
const GUILD_SWEEP_STAGGER_MS = 300;

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    const inviteLink = process.env.SERVER_INVITE_URL || 'https://discord.gg/fwVyfrtP4h';

    log.banner(`========================================`);
    log.banner(`🤖 Cleva boti muvaffaqiyatli ishga tushdi: ${client.user.tag}`);
    log.banner(`🌐 Serverlar soni: ${client.guilds.cache.size}`);
    log.banner(`🔗 Asosiy server havolasi: ${inviteLink}`);
    log.banner(`========================================`);

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
        log.debug('Bio yangilash (ixtiyoriy):', err.message);
      });
    } catch (e) {
      // Ignorlash
    }

    // 3. Server statistikasini har 10 daqiqada yangilab turish
    // Barcha serverlarni bitta tikda emas, navbat bilan (kichik siljish bilan)
    // aylanamiz - aks holda ko'p serverli botda hammasi bir vaqtda REST
    // so'rov yuborib rate limitga urilardi.
    const sweepGuildStats = () => {
      let i = 0;
      for (const guild of client.guilds.cache.values()) {
        const delay = (i++) * GUILD_SWEEP_STAGGER_MS;
        if (delay === 0) {
          updateGuildStats(guild);
        } else {
          setTimeout(() => updateGuildStats(guild), delay).unref?.();
        }
      }
    };

    // Bot yoqilganda 5 soniyadan keyin bir marta tekshirish
    setTimeout(sweepGuildStats, 5000);

    // Har 10 daqiqada yangilash (Rate limitga tushmaslik uchun)
    setInterval(sweepGuildStats, 10 * 60 * 1000);

    // 4. YouTube kanallari yangi videolarini avtomatik tekshirib borish
    initYouTubeNotifier(client);

    // 4.1. Restart/deploy paytida ochiq qolgan ovozli sessiyalarni tiklash.
    // evaluateDailyInactivity dan OLDIN bajarilishi kerak - aks holda hali
    // ovozda o'tirgan a'zoning vaqti hisobga olinmay qolishi mumkin.
    await restoreVoiceSessions(client).catch(err =>
      log.error('[VOICE RESTORE ERROR]:', err.message));

    // 5. Kunlik faollik rolini tekshirish va kirmaganlardan olib tashlash (har 15 daqiqada)
    setTimeout(() => {
      evaluateDailyInactivity(client).catch(err => log.error('[ACTIVE EVAL ERROR]:', err.message));
    }, 15000);

    setInterval(() => {
      evaluateDailyInactivity(client).catch(err => log.error('[ACTIVE EVAL ERROR]:', err.message));
    }, 15 * 60 * 1000);
  }
};
