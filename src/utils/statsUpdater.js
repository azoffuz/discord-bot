const storage = require('../config/storage');

// Har bir kanal uchun oxirgi o'zgartirilgan vaqtni saqlash (Rate-limit himoyasi)
const lastUpdateMap = new Map();

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
    console.warn(`[STATS UPDATE XATOSI (${channel.id} / ${expectedName})]:`, err.message);
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

  try {
    // A'zolarni to'liq keshga olish
    await guild.members.fetch().catch(() => {});
    const fetchedGuild = await guild.fetch().catch(() => guild);

    const total = guild.memberCount || guild.members.cache.size;
    const bots = guild.members.cache.filter(m => m.user.bot).size;
    const humans = Math.max(0, total - bots);
    const online = fetchedGuild.approximatePresenceCount ?? guild.members.cache.filter(m => m.presence && m.presence.status !== 'offline').size;
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
    console.error(`[STATS YANGILASH XATOSI (${guild.name})]:`, err.message);
  }
}

module.exports = {
  updateGuildStats
};
