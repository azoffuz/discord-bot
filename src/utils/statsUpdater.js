const storage = require('../config/storage');
const log = require('./log');

// Har bir kanal uchun oxirgi o'zgartirilgan vaqtni saqlash (Rate-limit himoyasi)
const lastUpdateMap = new Map();

// Har bir server uchun oxirgi to'liq hisoblash vaqti.
// Discord REST limiti: 10 daqiqada 2 marta nom o'zgartirish. Shuning uchun
// 5 daqiqadan tez-tez hisoblashning ma'nosi yo'q - qimmat so'rovlarni
// boshlashdan OLDIN to'xtatamiz (ilgari ular har safar bajarilar edi).
const GUILD_RECOMPUTE_MS = 5 * 60 * 1000;
const lastGuildRun = new Map();

async function getChannel(guild, channelId) {
  if (!channelId) return null;
  return guild.client.channels.cache.get(channelId) || await guild.client.channels.fetch(channelId).catch(() => null);
}

async function safelyRenameChannel(channel, expectedName, force = false) {
  if (!channel) return;
  if (channel.name === expectedName) return;

  const now = Date.now();
  const lastTime = lastUpdateMap.get(channel.id) || 0;

  // Discord REST API limit: 10 daqiqada 2 marta nom o'zgartirish ruxsat etiladi.
  // Shuning uchun xavfsiz 5 daqiqalik interval qo'llaniladi (agar force=true bo'lmasa)
  if (!force && (now - lastTime < 5 * 60 * 1000)) {
    return;
  }

  try {
    await channel.setName(expectedName);
    lastUpdateMap.set(channel.id, Date.now());
  } catch (err) {
    log.warn(`[STATS UPDATE XATOSI (${channel.id} / ${expectedName})]:`, err.message);
  }
}

async function updateGuildStats(guild, force = false) {
  if (!guild) return;

  const settings = storage.getGuildSettings(guild.id);
  if (!settings.stats || !settings.stats.enabled) return;

  const {
    totalChannelId,
    membersChannelId,
    botsChannelId,
    onlineChannelId,
    boostersChannelId,
    voiceChannelId
  } = settings.stats;

  if (!totalChannelId && !membersChannelId && !botsChannelId && !onlineChannelId && !boostersChannelId && !voiceChannelId) return;

  // Tarmoqqa chiqishdan oldingi to'xtatgich. voiceStateUpdate har bir harakatda
  // chaqiradi - shusiz har safar to'liq a'zolar ro'yxati tortib olinardi.
  const now = Date.now();
  if (!force && now - (lastGuildRun.get(guild.id) || 0) < GUILD_RECOMPUTE_MS) return;
  lastGuildRun.set(guild.id, now);

  try {
    // 1. Bot va booster sonini faqat kesh orqali bilish mumkin. Shuning uchun
    //    a'zolar ro'yxati faqat shu hisoblagichlar kerak bo'lsa VA kesh
    //    to'liq bo'lmasa tortib olinadi (ilgari har safar tortilardi).
    const needsMemberCache = Boolean(botsChannelId || boostersChannelId || membersChannelId);
    if (needsMemberCache && guild.members.cache.size < (guild.memberCount || 0)) {
      await guild.members.fetch().catch(() => {});
    }

    // 2. Jami va onlayn sonini bitta so'rovda olish (with_counts).
    //    GuildPresences intenti yoqilmagan, shuning uchun onlayn sonini
    //    keshdan hisoblab bo'lmaydi - approximatePresenceCount yagona manba.
    let total = guild.memberCount || 0;
    let online = null;

    if (totalChannelId || onlineChannelId) {
      const fetched = await guild.fetch().catch(() => null);
      if (fetched) {
        total = fetched.approximateMemberCount ?? fetched.memberCount ?? total;
        online = fetched.approximatePresenceCount ?? null;
      }
    }

    if (!total) total = guild.members.cache.size;
    if (online === null) {
      online = guild.members.cache.filter(m => m.presence && m.presence.status !== 'offline').size;
    }

    const bots = guild.members.cache.filter(m => m.user.bot).size;
    const humans = Math.max(0, total - bots);
    const boosters = guild.members.cache.filter(m => m.premiumSince !== null).size;
    const voice = guild.voiceStates.cache.filter(vs => vs.channelId).size;

    // Kanallarni qidirish (cross-server va local)
    const [totalCh, membersCh, botsCh, onlineCh, boostersCh, voiceCh] = await Promise.all([
      getChannel(guild, totalChannelId),
      getChannel(guild, membersChannelId),
      getChannel(guild, botsChannelId),
      getChannel(guild, onlineChannelId),
      getChannel(guild, boostersChannelId),
      getChannel(guild, voiceChannelId)
    ]);

    await Promise.all([
      safelyRenameChannel(totalCh, `👥・Jami A'zolar: ${total}`, force),
      safelyRenameChannel(membersCh, `👤・A'zolar: ${humans}`, force),
      safelyRenameChannel(botsCh, `🤖・Botlar: ${bots}`, force),
      safelyRenameChannel(onlineCh, `🟢・Onlayn: ${online}`, force),
      safelyRenameChannel(boostersCh, `🚀・Boosterlar: ${boosters}`, force),
      safelyRenameChannel(voiceCh, `🎙️・Ovozdagilar: ${voice}`, force)
    ]);
  } catch (err) {
    log.error(`[STATS YANGILASH XATOSI (${guild.name})]:`, err.message);
  }
}

module.exports = {
  updateGuildStats
};
