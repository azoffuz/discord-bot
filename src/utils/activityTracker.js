const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const storage = require('../config/storage');
const log = require('./log');

// Foydalanuvchilarning ovozli xonadagi faol sessiyalari (tez kesh).
// key: `${guildId}_${userId}`, value: startTime (ms)
// Haqiqiy manba - storage dagi `voiceSessionStart`: deploy/restart dan keyin
// bu Map bo'shab qoladi, shuning uchun u yerdan tiklanadi.
const voiceSessions = new Map();

const sessionKeyOf = (guildId, userId) => `${guildId}_${userId}`;

/** Sessiya boshlanishini oladi: avval keshdan, topilmasa saqlangan qiymatdan. */
function getSessionStart(guildId, userId) {
  const key = sessionKeyOf(guildId, userId);
  if (voiceSessions.has(key)) return voiceSessions.get(key);

  const stored = storage.getMemberActivity(guildId, userId).voiceSessionStart;
  if (stored) {
    voiceSessions.set(key, stored);
    return stored;
  }
  return null;
}

/** Sessiyani boshlaydi (yoki qayta boshlaydi) va diskka yozadi. */
function startSession(guildId, userId, at) {
  voiceSessions.set(sessionKeyOf(guildId, userId), at);
  storage.updateMemberActivity(guildId, userId, { voiceSessionStart: at });
}

/** Sessiyani yopadi va o'tgan vaqtni qaytaradi (yozmaydi). */
function endSession(guildId, userId, at) {
  const start = getSessionStart(guildId, userId);
  voiceSessions.delete(sessionKeyOf(guildId, userId));
  return start ? Math.max(0, at - start) : 0;
}

/**
 * Toshkent vaqti (UTC+5) bo'yicha bugungi sana satrini qaytaradi (YYYY-MM-DD)
 */
function getTodayDateStr() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const tashkentTime = new Date(utc + (3600000 * 5));
  return tashkentTime.toISOString().slice(0, 10);
}

/**
 * Toshkent vaqti (UTC+5) bo'yicha kechagi sana satrini qaytaradi (YYYY-MM-DD)
 */
function getYesterdayDateStr() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const tashkentYesterday = new Date(utc + (3600000 * 5) - 86400000);
  return tashkentYesterday.toISOString().slice(0, 10);
}

/**
 * Foydalanuvchining bugungi toza faollik obyektini qaytaradi (agar yangi kun bo'lsa kunlik hisoblagichlarni yangilaydi)
 */
function getCleanActivity(guildId, userId) {
  const raw = storage.getMemberActivity(guildId, userId);
  const today = getTodayDateStr();

  if (!raw.currentDate) {
    raw.currentDate = today;
    storage.updateMemberActivity(guildId, userId, { currentDate: today });
    return raw;
  }

  if (raw.currentDate !== today) {
    const updated = {
      ...raw,
      todayVoiceMs: 0,
      todayMessages: 0,
      currentDate: today
    };
    storage.updateMemberActivity(guildId, userId, updated);
    return updated;
  }

  return raw;
}

/**
 * A'zoning ayni paytdagi (real-time ovoz vaqti bilan birgalikdagi) faolligini qaytaradi
 */
function getRealTimeActivity(guildId, userId) {
  const activity = getCleanActivity(guildId, userId);

  let extraVoiceMs = 0;
  const startTime = getSessionStart(guildId, userId);
  if (startTime) {
    extraVoiceMs = Math.max(0, Date.now() - startTime);
  }

  const totalVoiceMs = (activity.todayVoiceMs || 0) + extraVoiceMs;
  const voiceMinutes = Math.floor(totalVoiceMs / 60000);
  const messages = activity.todayMessages || 0;

  return {
    ...activity,
    todayVoiceMs: totalVoiceMs,
    voiceMinutes,
    messages
  };
}

/**
 * Foydalanuvchi faollik mezonini bajarganini tekshiradi va rolni topshiradi
 */
async function checkAndAssignActiveRole(guild, member) {
  if (!guild || !member || member.user.bot) return false;

  const settings = storage.getActiveRoleSettings(guild.id);
  if (!settings.enabled || !settings.roleId) return false;

  const role = guild.roles.cache.get(settings.roleId) || await guild.roles.fetch(settings.roleId).catch(() => null);
  if (!role) return false;

  // Botning rolni berish imkoniyati (ierarxiya)ni tekshirish
  const botMember = guild.members.me;
  if (botMember && botMember.roles.highest.position <= role.position) {
    return false;
  }

  const activity = getRealTimeActivity(guild.id, member.id);
  const targetVoice = settings.voiceMinutes || 45;
  const targetMessages = settings.messageCount || 20;
  const mode = settings.mode || 'voice_or_messages';

  let qualified = false;
  if (mode === 'voice_or_messages') {
    qualified = activity.voiceMinutes >= targetVoice || activity.messages >= targetMessages;
  } else if (mode === 'voice_only') {
    qualified = activity.voiceMinutes >= targetVoice;
  } else if (mode === 'messages_only') {
    qualified = activity.messages >= targetMessages;
  } else if (mode === 'voice_and_messages') {
    qualified = activity.voiceMinutes >= targetVoice && activity.messages >= targetMessages;
  }

  const today = getTodayDateStr();

  if (qualified) {
    const hasDiscordRole = member.roles.cache.has(role.id);

    // Agar a'zoda rol hali yo'q bo'lsa -> Rol berish va tabriklash
    if (!hasDiscordRole) {
      try {
        await member.roles.add(role, 'Kunlik faollik normasi bajarildi (Cleva Active Role)');
        storage.updateMemberActivity(guild.id, member.id, {
          lastActiveDate: today,
          hasRole: true
        });

        // Tabriknoma yuborish (agar bildirishnoma o'chirilmagan bo'lsa va log kanali bo'lsa)
        const shouldSendMessage = settings.sendMessage !== false && !settings.silent;
        if (shouldSendMessage && settings.logChannelId) {
          const logChannel = guild.channels.cache.get(settings.logChannelId) || await guild.channels.fetch(settings.logChannelId).catch(() => null);
          if (logChannel && logChannel.isTextBased()) {
            const congratsEmbed = new EmbedBuilder()
              .setColor(0x57F287)
              .setTitle('🔥 Yangi Faol A\'zo!')
              .setDescription(
                `🎉 **Tabriklaymiz, ${member}!**\n` +
                `Siz bugungi server faollik normasini a\'lo darajada bajardingiz va <@&${role.id}> roliga ega bo'ldingiz! 🚀\n\n` +
                `📊 **Bugungi ko'rsatkichlaringiz:**\n` +
                `• 🎙️ Ovozda: **${activity.voiceMinutes} daqiqa** (talab: ${targetVoice} daqiqa)\n` +
                `• 💬 Chatda: **${activity.messages} ta xabar** (talab: ${targetMessages} ta)\n\n` +
                `💡 *Eslatma: Rolni saqlab qolish uchun ertasiga ham serverga kirib faol bo'lishni unutmang!*`
              )
              .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
              .setFooter({ text: 'Cleva • Daily Active Role System' })
              .setTimestamp();

            await logChannel.send({
              content: `🔥 ${member} — yangi faol a'zo!`,
              embeds: [congratsEmbed]
            }).catch(() => {});
          }
        }
        return true;
      } catch (err) {
        log.error('[ACTIVE ROLE BERISH XATOSI]:', err);
      }
    } else {
      // Agar a'zoda rol allaqachon bo'lsa, bugungi faollik sanasini yangilab qo'yish
      if (activity.lastActiveDate !== today) {
        storage.updateMemberActivity(guild.id, member.id, {
          lastActiveDate: today,
          hasRole: true
        });
      }
    }
  }

  return false;
}

/**
 * Xabar yozilganda xabarlar hisoblagichini oshiradi va faollikni tekshiradi
 */
async function handleMessage(message) {
  if (!message.guild || message.author.bot) return;

  const guild = message.guild;
  const settings = storage.getActiveRoleSettings(guild.id);
  if (!settings.enabled || !settings.roleId) return;

  const activity = getCleanActivity(guild.id, message.author.id);
  const newMessages = (activity.todayMessages || 0) + 1;

  storage.updateMemberActivity(guild.id, message.author.id, {
    todayMessages: newMessages
  });

  const member = message.member || await guild.members.fetch(message.author.id).catch(() => null);
  if (member) {
    await checkAndAssignActiveRole(guild, member);
  }
}

/**
 * Ovozli kanal holati o'zgarganda vaqtni hisoblaydi va faollikni tekshiradi
 */
async function handleVoiceUpdate(oldState, newState) {
  const member = newState.member || oldState.member;
  if (!member || member.user.bot) return;

  const guild = newState.guild || oldState.guild;
  if (!guild) return;

  const settings = storage.getActiveRoleSettings(guild.id);
  if (!settings.enabled || !settings.roleId) return;

  const userId = member.id;
  const sessionKey = `${guild.id}_${userId}`;
  const now = Date.now();

  // 1. Foydalanuvchi ovozli xonadan butunlay chiqdi
  if (oldState.channelId && !newState.channelId) {
    const elapsed = endSession(guild.id, userId, now);
    const activity = getCleanActivity(guild.id, userId);
    storage.updateMemberActivity(guild.id, userId, {
      todayVoiceMs: (activity.todayVoiceMs || 0) + elapsed,
      voiceSessionStart: null
    });
    if (elapsed > 0) await checkAndAssignActiveRole(guild, member);
    return;
  }

  // 2. Foydalanuvchi ovozli xonaga birinchi marta kirdi
  if (!oldState.channelId && newState.channelId) {
    startSession(guild.id, userId, now);
    return;
  }

  // 3. Foydalanuvchi bir xonadan boshqa xonaga ko'chdi
  if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
    const elapsed = endSession(guild.id, userId, now);
    const activity = getCleanActivity(guild.id, userId);
    voiceSessions.set(sessionKey, now);
    storage.updateMemberActivity(guild.id, userId, {
      todayVoiceMs: (activity.todayVoiceMs || 0) + elapsed,
      voiceSessionStart: now
    });
    if (elapsed > 0) await checkAndAssignActiveRole(guild, member);
  }
}

/**
 * Bot qayta ishga tushganda ochiq qolgan ovozli sessiyalarni tiklash.
 *
 * - A'zo hali ham ovozli xonada bo'lsa: sessiya davom etadi (saqlangan
 *   boshlanish vaqti keshga qaytariladi), ya'ni deploy vaqti yo'qolmaydi.
 * - A'zo allaqachon chiqib ketgan bo'lsa: qachon chiqqani noma'lum, shuning
 *   uchun sessiya hisoblanmasdan yopiladi (vaqtni to'qib chiqarmaymiz).
 */
async function restoreVoiceSessions(client) {
  let resumed = 0;
  let closed = 0;

  for (const [, guild] of client.guilds.cache) {
    const settings = storage.getActiveRoleSettings(guild.id);
    if (!settings.enabled) continue;

    for (const [userId, data] of Object.entries(storage.getAllActiveMembers(guild.id))) {
      if (!data.voiceSessionStart) continue;

      const stillConnected = Boolean(guild.voiceStates.cache.get(userId)?.channelId);
      if (stillConnected) {
        voiceSessions.set(sessionKeyOf(guild.id, userId), data.voiceSessionStart);
        resumed++;
      } else {
        storage.updateMemberActivity(guild.id, userId, { voiceSessionStart: null });
        closed++;
      }
    }
  }

  if (resumed || closed) {
    log.info(`🎙️ Ovozli sessiyalar tiklandi: ${resumed} ta davom etmoqda, ${closed} ta yopildi.`);
  }
  return { resumed, closed };
}

/** A'zo serverdan chiqsa keshda ochiq sessiya qolib ketmasin. */
function forgetMember(guildId, userId) {
  voiceSessions.delete(sessionKeyOf(guildId, userId));
}

/**
 * Kunlik faolsiz a'zolarni tekshirish va rolni olib tashlash jarayoni
 * "ertasiga kirmasa olib tashlashi"
 */
async function evaluateDailyInactivity(client) {
  const today = getTodayDateStr();
  const yesterday = getYesterdayDateStr();

  for (const [, guild] of client.guilds.cache) {
    const settings = storage.getActiveRoleSettings(guild.id);
    if (!settings.enabled || !settings.roleId) continue;

    const role = guild.roles.cache.get(settings.roleId) || await guild.roles.fetch(settings.roleId).catch(() => null);
    if (!role) continue;

    const botMember = guild.members.me || await guild.members.fetchMe().catch(() => null);
    if (!botMember || botMember.roles.highest.position <= role.position) continue;

    const allMembersActivity = storage.getAllActiveMembers(guild.id);

    // Rolga ega bo'lgan a'zolarni tekshirish
    for (const [userId, actData] of Object.entries(allMembersActivity)) {
      // Faqat rol berilgan bo'lgan a'zolarni ko'rib chiqamiz
      if (!actData.hasRole && !actData.lastActiveDate) continue;

      const member = guild.members.cache.get(userId) || await guild.members.fetch(userId).catch(() => null);
      if (!member) continue;

      const hasDiscordRole = member.roles.cache.has(role.id);
      if (!hasDiscordRole) continue;

      // Agar foydalanuvchi bugun ham, kecha ham faollik ko'rsatmagan bo'lsa
      // (ya'ni kechadan oldingi kunda olgan va kecha kirmagan / bugun hali kirmagan)
      const lastActive = actData.lastActiveDate;
      const isActiveRecently = lastActive === today || lastActive === yesterday;

      if (!isActiveRecently) {
        try {
          await member.roles.remove(role, 'Kechagi kunda faollik ko\'rsatmaganligi sababli rol olib tashlandi');
          storage.updateMemberActivity(guild.id, userId, { hasRole: false });

          const shouldSendMessage = settings.sendMessage !== false && !settings.silent;
          if (shouldSendMessage && settings.logChannelId) {
            const logChannel = guild.channels.cache.get(settings.logChannelId) || await guild.channels.fetch(settings.logChannelId).catch(() => null);
            if (logChannel && logChannel.isTextBased()) {
              const noticeEmbed = new EmbedBuilder()
                .setColor(0xED4245)
                .setTitle('⏳ Faollik Roli Olib Tashlandi')
                .setDescription(
                  `⚠️ ${member} kechagi kunda serverda faollik ko'rsatmaganligi sababli <@&${role.id}> roli olib tashlandi.\n\n` +
                  `💡 *Rolni qayta qo'lga kiritish uchun bugun ovozli xonada o'tiring yoki chatda faol bo'ling!*`
                )
                .setFooter({ text: 'Cleva • Daily Active Role System' })
                .setTimestamp();

              await logChannel.send({ embeds: [noticeEmbed] }).catch(() => {});
            }
          }
        } catch (err) {
          log.error(`[ACTIVE ROLE OLIB TASHLASH XATOSI] (${userId}):`, err.message);
        }
      }
    }
  }
}

module.exports = {
  restoreVoiceSessions,
  forgetMember,
  getTodayDateStr,
  getYesterdayDateStr,
  getRealTimeActivity,
  checkAndAssignActiveRole,
  handleMessage,
  handleVoiceUpdate,
  evaluateDailyInactivity
};
