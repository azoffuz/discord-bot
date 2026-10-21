const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const levelCurve = require('../utils/levelCurve');

const DATA_DIR = path.join(__dirname, '../../data');
const DATA_FILE = path.join(DATA_DIR, 'settings.json');

// In-memory kesh
let memoryCache = {};
let supabaseStatus = {
  connected: false,
  message: 'Supabase sozlanmagan (Lokal rejim)',
  url: null
};

// Supabase mijozini sozlash
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
let supabase = null;

if (supabaseUrl && supabaseKey && supabaseUrl.startsWith('http')) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
    supabaseStatus.url = supabaseUrl;
  } catch (err) {
    supabaseStatus.message = `Supabase client yaratishda xato: ${err.message}`;
  }
}

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({}, null, 2), 'utf8');
  }
}

function readLocalFile() {
  try {
    ensureFile();
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw || '{}');
  } catch (err) {
    console.error('Lokal fayl o\'qishda xatolik:', err);
    return {};
  }
}

function writeLocalFile(data) {
  try {
    ensureFile();
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Lokal fayl yozishda xatolik:', err);
    return false;
  }
}

let rlsWarningLogged = false;

// ===================== DARAJA (LEVEL) YORDAMCHILARI =====================

function defaultLeveling() {
  return {
    enabled: false,
    channelId: null,
    // Daraja mukofotlari: [{ level, roleId }], darajasi bo'yicha o'sish tartibida
    rewards: [],
    // 'stack' - barcha qo'lga kiritilgan rollar qoladi,
    // 'highest' - faqat eng yuqori mukofot roli qoladi
    rewardMode: 'stack',
    // Ovozli xonada o'tirgani uchun ham XP berilsinmi
    voiceXp: true,
    // XP ko'paytiruvchilari. 0 - umuman XP berilmaydi (no-XP rol/kanal).
    // roles/channels: { [id]: ko'paytiruvchi }, event: { multiplier, endsAt } yoki null
    multipliers: {
      roles: {},
      channels: {},
      event: null
    },
    // Daraja e'loni: mode 'auto' (sozlangan kanal, bo'lmasa joriy chat) | 'dm' | 'off';
    // message - shablon ({user} {username} {level} {server} {role}), null = standart;
    // every - har nechta darajada e'lon qilinadi (mukofot roli doim e'lon qilinadi)
    announce: {
      mode: 'auto',
      message: null,
      every: 1
    },
    users: {}
  };
}

// Allaqachon tekshirilgan leveling obyektlari (har o'qishda qayta yugurmaslik uchun)
const normalizedLeveling = new WeakSet();

/**
 * Eski shakldagi ({ xp, level } - XP har darajada nolga tushadi) daraja
 * yozuvini yangi shaklga ({ totalXp, level }) o'tkazadi. Yangi yozuvlar
 * (totalXp mavjud) tegilmaydi.
 */
function migrateLevelUser(user) {
  if (!user || typeof user.totalXp === 'number') return;
  user.totalXp = levelCurve.totalXpFromLegacy(user.level, user.xp);
  user.level = levelCurve.levelFromXp(user.totalXp);
  delete user.xp;
}

/** Yetishmayotgan leveling xossalarini to'ldiradi va eski yozuvlarni ko'chiradi */
function normalizeLeveling(settings) {
  if (!settings.leveling) settings.leveling = defaultLeveling();
  const leveling = settings.leveling;
  if (normalizedLeveling.has(leveling)) return leveling;

  const defaults = defaultLeveling();
  for (const key of Object.keys(defaults)) {
    if (leveling[key] === undefined) leveling[key] = defaults[key];
  }
  if (!leveling.users) leveling.users = {};
  if (!Array.isArray(leveling.rewards)) leveling.rewards = [];
  leveling.multipliers = { ...defaults.multipliers, ...leveling.multipliers };
  leveling.announce = { ...defaults.announce, ...leveling.announce };

  for (const user of Object.values(leveling.users)) migrateLevelUser(user);

  normalizedLeveling.add(leveling);
  return leveling;
}

function levelUser(leveling, userId) {
  if (!leveling.users[userId]) {
    leveling.users[userId] = {
      totalXp: 0,
      level: levelCurve.MIN_LEVEL,
      messages: 0,
      voiceMinutes: 0,
      lastXp: 0
    };
  }
  return leveling.users[userId];
}

const PERIODS = ['week', 'month'];

/**
 * Haftalik/oylik hisoblagichlarni oshiradi. Davr kaliti eskirgan bo'lsa
 * (yangi hafta/oy boshlangan) avval nolga tushiriladi.
 */
function bumpPeriods(userData, { xp = 0, messages = 0, voice = 0 }) {
  const keys = levelCurve.periodKeys();
  if (!userData.periods) userData.periods = {};
  for (const period of PERIODS) {
    let entry = userData.periods[period];
    if (!entry || entry.key !== keys[period]) {
      entry = { key: keys[period], xp: 0, messages: 0, voice: 0 };
      userData.periods[period] = entry;
    }
    entry.xp += xp;
    entry.messages += messages;
    entry.voice += voice;
  }
}

/** Joriy davrdagi hisoblagichlar (eskirgan bo'lsa nollar) */
function periodStats(userData, period, keys) {
  const entry = userData?.periods?.[period];
  return entry && entry.key === keys[period] ? entry : { xp: 0, messages: 0, voice: 0 };
}

/** Jami XP ni o'rnatadi va darajani yangilaydi (saqlash chaqiruvchida) */
function setTotalXp(userData, totalXp) {
  const oldLevel = levelCurve.levelFromXp(userData.totalXp);
  userData.totalXp = Math.max(0, Math.floor(totalXp));

  const p = levelCurve.progress(userData.totalXp);
  userData.level = p.level;

  return {
    leveledUp: p.level > oldLevel,
    oldLevel,
    newLevel: p.level,
    currentXP: p.xp,
    requiredXP: p.requiredXP,
    remainingXP: p.remainingXP,
    totalXp: p.totalXp
  };
}

// Supabase ga orqa fonda asinxron saqlash
async function syncToSupabase(guildId, data) {
  if (!supabase || !supabaseStatus.connected) return;
  try {
    const { error } = await supabase
      .from('guild_settings')
      .upsert({ guild_id: guildId, data: data });

    if (error) {
      if (error.message && error.message.includes('row-level security')) {
        if (!rlsWarningLogged) {
          rlsWarningLogged = true;
          console.warn('⚠️ [SUPABASE RLS XATOSI]: guild_settings jadvalida Row Level Security (RLS) yoqilgan.');
          console.warn('💡 TEZ YECHIM: Supabase -> SQL Editor ga kirib quyidagi 1 qator kodni ishga tushiring (Run):');
          console.warn('   ALTER TABLE guild_settings DISABLE ROW LEVEL SECURITY;');
          console.warn('   Yoki Render ENV dagi SUPABASE_KEY ga "service_role" secret kalitini kiriting.');
        }
      } else {
        console.warn('[SUPABASE SAQLASH XATOSI]:', error.message);
      }
    }
  } catch (err) {
    console.warn('[SUPABASE EXCEPTION]:', err.message);
  }
}

module.exports = {
  getSupabaseStatus() {
    return supabaseStatus;
  },

  // Bot ishga tushganda bazani yuklash va natijani konsolga chiqarish
  async init() {
    // 1. Lokal fayldan o'qish
    memoryCache = readLocalFile();

    // 2. Agar Supabase parametrlari kiritilmagan bo'lsa
    if (!supabase) {
      supabaseStatus.connected = false;
      supabaseStatus.message = 'SUPABASE_URL yoki SUPABASE_KEY kiritilmagan (Lokal rejim)';
      console.log('====================================================');
      console.log('🗄️ SUPABASE BAZASI HOLATI:');
      console.log('❌ ULANMADI: SUPABASE_URL yoki SUPABASE_KEY kiritilmagan!');
      console.log('⚠️ Bot vaqtinchalik lokal xotira (JSON) rejimida ishlamoqda.');
      console.log('💡 Render ENV ga kalitlarni kiritsangiz, sozlamalar abadiy saqlanadi.');
      console.log('====================================================');
      return;
    }

    // 3. Supabase ga ulanishni tekshirish va ma'lumotlarni tortib olish
    try {
      console.log('⏳ Supabase ga ulanilmoqda va ma\'lumotlar tekshirilmoqda...');
      const { data, error } = await supabase
        .from('guild_settings')
        .select('guild_id, data');

      if (error) {
        supabaseStatus.connected = false;
        supabaseStatus.message = `Xatolik: ${error.message}`;
        console.log('====================================================');
        console.log('🗄️ SUPABASE BAZASI HOLATI:');
        console.log(`⚠️ ULANISHDA XATOLIK: ${error.message}`);
        console.log('💡 Iltimos, Supabase SQL Editor da jadval yaratilganini tekshiring:');
        console.log('   CREATE TABLE guild_settings (guild_id TEXT PRIMARY KEY, data JSONB);');
        console.log('====================================================');
      } else {
        supabaseStatus.connected = true;
        supabaseStatus.message = 'Muvaffaqiyatli ulandi (Faol)';
        const count = data ? data.length : 0;

        if (data && data.length > 0) {
          data.forEach(row => {
            if (row.guild_id && row.data) {
              memoryCache[row.guild_id] = row.data;
            }
          });
          writeLocalFile(memoryCache);
        }

        console.log('====================================================');
        console.log('🗄️ SUPABASE BAZASI HOLATI:');
        console.log('✅ ULANDI: Supabase bulutli bazasiga muvaffaqiyatli ulandi!');
        console.log(`🔗 Manzil: ${supabaseUrl}`);
        console.log(`📊 Saqlangan serverlar soni: ${count} ta`);
        console.log('🔒 Deploy bo\'lganda ham sozlamalar va ticketlar saqlanadi.');
        console.log('====================================================');
      }
    } catch (err) {
      supabaseStatus.connected = false;
      supabaseStatus.message = `Ulanish istisnosi: ${err.message}`;
      console.log('====================================================');
      console.log('🗄️ SUPABASE BAZASI HOLATI:');
      console.log(`❌ KUTILMAGAN XATOLIK: ${err.message}`);
      console.log('====================================================');
    }
  },

  getGuildSettings(guildId) {
    if (!memoryCache[guildId]) {
      memoryCache[guildId] = {
        logChannelId: null,
        logCategoryId: null,
        logChannels: {
          messages: null,
          members: null,
          moderation: null,
          tickets: null,
          voice: null
        },
        welcomeChannelId: null,
        welcomeMessage: 'Xush kelibsiz, {user}! Siz serverimizning {memberCount}-a\'zosisiz 🎉',
        welcomeEnabled: false,
        ticketChannelId: null,
        ticketCategoryId: null,
        supportRoleId: null,
        ticketCounter: 0,
        autoRoleId: null,
        antiLinkEnabled: true,
        linkWhitelist: [],
        warns: {},
        stats: {
          enabled: false,
          categoryId: null,
          totalChannelId: null,
          membersChannelId: null,
          botsChannelId: null
        },
        tempVoice: {
          enabled: false,
          categoryId: null,
          channelId: null
        },
        leveling: defaultLeveling(),
        mediaRoles: {
          enabled: false,
          roles: []
        },
        youtubeNotifier: {
          enabled: false,
          channelId: null,
          youtubeChannelId: null,
          youtubeChannelName: null,
          youtubeChannelUrl: null,
          pingRoleId: null,
          customMessage: null,
          lastVideoId: null
        },
        teamArchive: {
          fillChannelId: null,
          channelId: null,
          headRoleId: null,
          moderRoleId: null,
          pingRoleId: null,
          allowPublicView: true,
          members: {}
        },
        activeRole: {
          enabled: false,
          roleId: null,
          voiceMinutes: 45,
          messageCount: 20,
          mode: 'voice_or_messages',
          logChannelId: null,
          sendMessage: true,
          silent: false,
          members: {}
        }
      };
    } else {
      // Mavjud obyektda yangi xossalar yo'q bo'lsa to'ldirib qo'yish
      if (memoryCache[guildId].antiLinkEnabled === undefined) memoryCache[guildId].antiLinkEnabled = true;
      if (!Array.isArray(memoryCache[guildId].linkWhitelist)) memoryCache[guildId].linkWhitelist = [];
      if (!memoryCache[guildId].mediaRoles) {
        memoryCache[guildId].mediaRoles = {
          enabled: false,
          roles: []
        };
      }
      if (!memoryCache[guildId].youtubeNotifier) {
        memoryCache[guildId].youtubeNotifier = {
          enabled: false,
          channelId: null,
          youtubeChannelId: null,
          youtubeChannelName: null,
          youtubeChannelUrl: null,
          pingRoleId: null,
          customMessage: null,
          lastVideoId: null
        };
      }
      if (!memoryCache[guildId].logChannels) {
        memoryCache[guildId].logChannels = {
          messages: null,
          members: null,
          moderation: null,
          tickets: null,
          voice: null
        };
      }
      if (!memoryCache[guildId].stats) {
        memoryCache[guildId].stats = {
          enabled: false,
          categoryId: null,
          totalChannelId: null,
          membersChannelId: null,
          botsChannelId: null
        };
      }
      if (!memoryCache[guildId].tempVoice) {
        memoryCache[guildId].tempVoice = {
          enabled: false,
          categoryId: null,
          channelId: null
        };
      }
      if (!memoryCache[guildId].teamArchive) {
        memoryCache[guildId].teamArchive = {
          fillChannelId: null,
          channelId: null,
          headRoleId: null,
          moderRoleId: null,
          pingRoleId: null,
          allowPublicView: true,
          members: {}
        };
      }
      if (!memoryCache[guildId].activeRole) {
        memoryCache[guildId].activeRole = {
          enabled: false,
          roleId: null,
          voiceMinutes: 45,
          messageCount: 20,
          mode: 'voice_or_messages',
          logChannelId: null,
          sendMessage: true,
          silent: false,
          members: {}
        };
      }
    }
    normalizeLeveling(memoryCache[guildId]);
    return memoryCache[guildId];
  },

  updateGuildSettings(guildId, newSettings) {
    const current = this.getGuildSettings(guildId);
    memoryCache[guildId] = {
      ...current,
      ...newSettings
    };

    writeLocalFile(memoryCache);
    syncToSupabase(guildId, memoryCache[guildId]);

    return memoryCache[guildId];
  },

  addWarn(guildId, userId, reason, moderatorId) {
    const guildSettings = this.getGuildSettings(guildId);
    if (!guildSettings.warns) guildSettings.warns = {};
    if (!guildSettings.warns[userId]) guildSettings.warns[userId] = [];

    const warnEntry = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
      reason,
      moderatorId,
      date: new Date().toISOString()
    };

    guildSettings.warns[userId].push(warnEntry);
    this.updateGuildSettings(guildId, { warns: guildSettings.warns });

    return {
      warn: warnEntry,
      totalWarns: guildSettings.warns[userId].length
    };
  },

  getUserWarns(guildId, userId) {
    const guildSettings = this.getGuildSettings(guildId);
    if (!guildSettings.warns || !guildSettings.warns[userId]) {
      return [];
    }
    return guildSettings.warns[userId];
  },

  removeUserWarn(guildId, userId, warnId) {
    const guildSettings = this.getGuildSettings(guildId);
    if (!guildSettings.warns || !guildSettings.warns[userId]) {
      return false;
    }
    const index = guildSettings.warns[userId].findIndex(w => w.id === warnId);
    if (index === -1) return false;

    const removed = guildSettings.warns[userId].splice(index, 1)[0];
    this.updateGuildSettings(guildId, { warns: guildSettings.warns });
    return removed;
  },

  clearUserWarns(guildId, userId) {
    const guildSettings = this.getGuildSettings(guildId);
    if (!guildSettings.warns || !guildSettings.warns[userId]) {
      return 0;
    }
    const count = guildSettings.warns[userId].length;
    guildSettings.warns[userId] = [];
    this.updateGuildSettings(guildId, { warns: guildSettings.warns });
    return count;
  },

  incrementTicketCounter(guildId) {
    const guildSettings = this.getGuildSettings(guildId);
    guildSettings.ticketCounter = (guildSettings.ticketCounter || 0) + 1;
    this.updateGuildSettings(guildId, { ticketCounter: guildSettings.ticketCounter });
    return guildSettings.ticketCounter;
  },

  /** Leveling ma'lumotlarini (diskka va Supabase ga) saqlaydi */
  saveLeveling(guildId) {
    const settings = this.getGuildSettings(guildId);
    this.updateGuildSettings(guildId, { leveling: settings.leveling });
  },

  /**
   * Xabar uchun XP beradi. eligible=false bo'lsa (spam filtridan o'tmagan
   * xabar) faqat xabar hisoblagichi oshadi. XP berilmasa null qaytaradi.
   */
  addXP(guildId, userId, { eligible = true, multiplier = 1 } = {}) {
    const leveling = this.getGuildSettings(guildId).leveling;
    if (!leveling.enabled) return null;

    const userData = levelUser(leveling, userId);
    const now = Date.now();
    userData.messages = (userData.messages || 0) + 1;
    bumpPeriods(userData, { messages: 1 });

    if (!eligible || multiplier <= 0) return null;

    // Anti-spam cooldown (bir daqiqada 1 marta XP)
    const { min, max, cooldownMs } = levelCurve.MESSAGE_XP;
    if (now - (userData.lastXp || 0) < cooldownMs) return null;

    userData.lastXp = now;
    const earnedXP = Math.round((Math.floor(Math.random() * (max - min + 1)) + min) * multiplier);
    bumpPeriods(userData, { xp: earnedXP });
    const result = setTotalXp(userData, (userData.totalXp || 0) + earnedXP);
    this.saveLeveling(guildId);
    return { earnedXP, ...result };
  },

  /**
   * Ovozli xonada o'tkazilgan 1 daqiqa uchun XP beradi.
   * persist=false bo'lsa saqlash chaqiruvchida (saveLeveling) - bir daqiqalik
   * tikda har a'zo uchun butun sozlamalarni qayta yozmaslik uchun.
   */
  addVoiceXP(guildId, userId, { multiplier = 1, persist = true } = {}) {
    const leveling = this.getGuildSettings(guildId).leveling;
    if (!leveling.enabled || leveling.voiceXp === false) return null;
    if (multiplier <= 0) return null;

    const userData = levelUser(leveling, userId);
    const earnedXP = Math.round(levelCurve.VOICE_XP.perMinute * multiplier);
    userData.voiceMinutes = (userData.voiceMinutes || 0) + 1;
    bumpPeriods(userData, { xp: earnedXP, voice: 1 });
    const result = setTotalXp(userData, (userData.totalXp || 0) + earnedXP);
    if (persist) this.saveLeveling(guildId);
    return { earnedXP, ...result };
  },

  /** leveling sozlamalarining bir qismini yangilaydi (users dan tashqari) */
  updateLevelingSettings(guildId, patch) {
    const leveling = this.getGuildSettings(guildId).leveling;
    this.updateGuildSettings(guildId, { leveling: { ...leveling, ...patch } });
    return this.getGuildSettings(guildId).leveling;
  },

  /**
   * isMember berilsa (id => boolean), serverdan chiqib ketganlar o'rinni
   * hisoblashda e'tiborga olinmaydi.
   */
  getUserLevel(guildId, userId, { isMember = null } = {}) {
    const leveling = this.getGuildSettings(guildId).leveling;
    const enabled = Boolean(leveling.enabled);
    const userData = leveling.users[userId];
    const totalXp = userData?.totalXp || 0;
    const p = levelCurve.progress(totalXp);

    // O'rinni bitta o'tishda hisoblash (butun ro'yxatni saralamasdan).
    // Hali XP to'plamagan a'zo reytingda yo'q (rank: null).
    let rank = null;
    if (totalXp > 0) {
      let ahead = 0;
      for (const [id, data] of Object.entries(leveling.users)) {
        if (id === userId || (data.totalXp || 0) <= totalXp) continue;
        if (isMember && !isMember(id)) continue;
        ahead++;
      }
      rank = ahead + 1;
    }

    return {
      level: p.level,
      xp: p.xp,
      requiredXP: p.requiredXP,
      remainingXP: p.remainingXP,
      totalXp,
      messages: userData?.messages || 0,
      voiceMinutes: userData?.voiceMinutes || 0,
      rank,
      enabled
    };
  },

  /**
   * To'liq saralangan reyting (sahifalash chaqiruvchida).
   * period: 'all' | 'month' | 'week'; type: 'xp' | 'messages' | 'voice'.
   * Har bir yozuvda value - tanlangan ko'rsatkich qiymati.
   */
  getLeaderboard(guildId, { period = 'all', type = 'xp', isMember = null } = {}) {
    const leveling = this.getGuildSettings(guildId).leveling;
    const enabled = Boolean(leveling.enabled);
    const keys = levelCurve.periodKeys();

    const valueOf = (data) => {
      if (period === 'all') {
        if (type === 'messages') return data.messages || 0;
        if (type === 'voice') return data.voiceMinutes || 0;
        return data.totalXp || 0;
      }
      const stats = periodStats(data, period, keys);
      return type === 'messages' ? stats.messages : type === 'voice' ? stats.voice : stats.xp;
    };

    const list = Object.entries(leveling.users)
      .filter(([id]) => !isMember || isMember(id))
      .map(([id, data]) => ({
        id,
        value: valueOf(data),
        level: levelCurve.levelFromXp(data.totalXp),
        totalXp: data.totalXp || 0
      }))
      .filter(entry => entry.value > 0)
      .sort((a, b) => b.value - a.value || b.totalXp - a.totalXp);

    return { list, enabled };
  },

  /**
   * Admin XP o'zgartirishi. op: 'give' | 'remove' | 'set' (amount - jami XP).
   * Haftalik/oylik reytingga ta'sir qilmaydi - ular faqat faollikni ko'rsatadi.
   */
  adjustXP(guildId, userId, op, amount) {
    const userData = levelUser(this.getGuildSettings(guildId).leveling, userId);
    const current = userData.totalXp || 0;
    const target = op === 'give' ? current + amount : op === 'remove' ? current - amount : amount;
    const result = setTotalXp(userData, target);
    this.saveLeveling(guildId);
    return result;
  },

  /** /addxp buyrug'i uchun: XP qo'shadi va yangi o'rinni ham qaytaradi */
  giveUserXP(guildId, userId, amount) {
    const result = this.adjustXP(guildId, userId, 'give', Number(amount));
    const { rank } = this.getUserLevel(guildId, userId);
    return { ...result, rank: rank || 1, addedXP: amount };
  },

  /** Bitta a'zoning XP, hisoblagich va davrlarini nolga tushiradi */
  resetUserLevel(guildId, userId) {
    const userData = this.getGuildSettings(guildId).leveling.users[userId];
    if (!userData) return false;
    Object.assign(userData, { messages: 0, voiceMinutes: 0, periods: {} });
    setTotalXp(userData, 0);
    this.saveLeveling(guildId);
    return true;
  },

  /** Serverdagi barcha a'zolarning darajasini nolga tushiradi. Soni qaytadi. */
  resetAllLevels(guildId) {
    const users = Object.values(this.getGuildSettings(guildId).leveling.users);
    for (const userData of users) {
      Object.assign(userData, { messages: 0, voiceMinutes: 0, periods: {} });
      setTotalXp(userData, 0);
    }
    this.saveLeveling(guildId);
    return users.length;
  },

  getLevelRewards(guildId) {
    const leveling = this.getGuildSettings(guildId).leveling;
    return {
      rewards: leveling.rewards,
      mode: leveling.rewardMode === 'highest' ? 'highest' : 'stack'
    };
  },

  /** Darajaga rol mukofotini biriktiradi. Bir daraja - bir rol, bir rol - bir daraja. */
  setLevelReward(guildId, level, roleId) {
    const leveling = this.getGuildSettings(guildId).leveling;
    const rewards = leveling.rewards
      .filter(r => r.level !== level && r.roleId !== roleId)
      .concat({ level, roleId })
      .sort((a, b) => a.level - b.level);
    this.updateLevelingSettings(guildId, { rewards });
    return rewards;
  },

  /** Mukofotni daraja yoki rol bo'yicha o'chiradi. O'chirilganini qaytaradi (yoki null). */
  removeLevelReward(guildId, { level = null, roleId = null }) {
    const leveling = this.getGuildSettings(guildId).leveling;
    const removed = leveling.rewards.find(r => r.level === level || r.roleId === roleId) || null;
    if (!removed) return null;
    this.updateLevelingSettings(guildId, { rewards: leveling.rewards.filter(r => r !== removed) });
    return removed;
  },

  setLevelRewardMode(guildId, mode) {
    this.updateLevelingSettings(guildId, { rewardMode: mode });
  },

  // ===================== MEGA TEAM ARXIVI METODLARI =====================
  setTeamArchiveSettings(guildId, newSettings) {
    const settings = this.getGuildSettings(guildId);
    if (!settings.teamArchive) {
      settings.teamArchive = { fillChannelId: null, channelId: null, headRoleId: null, moderRoleId: null, pingRoleId: null, allowPublicView: true, members: {} };
    }
    settings.teamArchive = {
      ...settings.teamArchive,
      ...newSettings
    };
    this.updateGuildSettings(guildId, { teamArchive: settings.teamArchive });
    return settings.teamArchive;
  },

  saveTeamMember(guildId, userId, memberData) {
    const settings = this.getGuildSettings(guildId);
    if (!settings.teamArchive) {
      settings.teamArchive = { channelId: null, headRoleId: null, moderRoleId: null, members: {} };
    }
    if (!settings.teamArchive.members) {
      settings.teamArchive.members = {};
    }

    settings.teamArchive.members[userId] = {
      ...(settings.teamArchive.members[userId] || {}),
      ...memberData,
      updatedAt: new Date().toISOString()
    };

    this.updateGuildSettings(guildId, { teamArchive: settings.teamArchive });
    return settings.teamArchive.members[userId];
  },

  getTeamMember(guildId, userId) {
    const settings = this.getGuildSettings(guildId);
    return settings.teamArchive?.members?.[userId] || null;
  },

  getAllTeamMembers(guildId) {
    const settings = this.getGuildSettings(guildId);
    return settings.teamArchive?.members || {};
  },

  removeTeamMember(guildId, userId) {
    const settings = this.getGuildSettings(guildId);
    if (!settings.teamArchive || !settings.teamArchive.members || !settings.teamArchive.members[userId]) {
      return false;
    }
    const removed = settings.teamArchive.members[userId];
    delete settings.teamArchive.members[userId];
    this.updateGuildSettings(guildId, { teamArchive: settings.teamArchive });
    return removed;
  },

  // ===================== KUNLIK FAOLLIK ROLI METODLARI =====================
  getActiveRoleSettings(guildId) {
    const settings = this.getGuildSettings(guildId);
    const activeRole = settings.activeRole || {
      enabled: false,
      roleId: null,
      voiceMinutes: 45,
      messageCount: 20,
      mode: 'voice_or_messages',
      logChannelId: null,
      sendMessage: true,
      silent: false,
      ignoredRoles: [],
      members: {}
    };

    if (!Array.isArray(activeRole.ignoredRoles)) {
      activeRole.ignoredRoles = [];
    }

    if (activeRole.sendMessage === undefined) {
      activeRole.sendMessage = activeRole.silent !== undefined ? !activeRole.silent : true;
    }
    if (activeRole.silent === undefined) {
      activeRole.silent = !activeRole.sendMessage;
    }

    return activeRole;
  },

  updateActiveRoleSettings(guildId, newSettings) {
    const settings = this.getGuildSettings(guildId);
    if (!settings.activeRole) {
      settings.activeRole = {
        enabled: false,
        roleId: null,
        voiceMinutes: 45,
        messageCount: 20,
        mode: 'voice_or_messages',
        logChannelId: null,
        sendMessage: true,
        silent: false,
        ignoredRoles: [],
        members: {}
      };
    }
    if (!Array.isArray(settings.activeRole.ignoredRoles)) {
      settings.activeRole.ignoredRoles = [];
    }
    settings.activeRole = {
      ...settings.activeRole,
      ...newSettings
    };
    if (Array.isArray(newSettings.ignoredRoles)) {
      settings.activeRole.ignoredRoles = newSettings.ignoredRoles;
    }
    if (settings.activeRole.sendMessage !== undefined && newSettings.silent === undefined) {
      settings.activeRole.silent = !settings.activeRole.sendMessage;
    } else if (settings.activeRole.silent !== undefined && newSettings.sendMessage === undefined) {
      settings.activeRole.sendMessage = !settings.activeRole.silent;
    }
    this.updateGuildSettings(guildId, { activeRole: settings.activeRole });
    return settings.activeRole;
  },

  getMemberActivity(guildId, userId) {
    const activeSettings = this.getActiveRoleSettings(guildId);
    return activeSettings.members?.[userId] || {
      todayVoiceMs: 0,
      todayMessages: 0,
      currentDate: null,
      lastActiveDate: null,
      hasRole: false
    };
  },

  updateMemberActivity(guildId, userId, data) {
    const settings = this.getGuildSettings(guildId);
    if (!settings.activeRole) {
      settings.activeRole = {
        enabled: false,
        roleId: null,
        voiceMinutes: 45,
        messageCount: 20,
        mode: 'voice_or_messages',
        logChannelId: null,
        sendMessage: true,
        silent: false,
        members: {}
      };
    }
    if (!settings.activeRole.members) {
      settings.activeRole.members = {};
    }

    settings.activeRole.members[userId] = {
      ...(settings.activeRole.members[userId] || {
        todayVoiceMs: 0,
        todayMessages: 0,
        currentDate: null,
        lastActiveDate: null,
        hasRole: false
      }),
      ...data
    };

    this.updateGuildSettings(guildId, { activeRole: settings.activeRole });
    return settings.activeRole.members[userId];
  },

  getAllActiveMembers(guildId) {
    const activeSettings = this.getActiveRoleSettings(guildId);
    return activeSettings.members || {};
  },

  // ===================== TAQIQLANGAN SO'ZLAR (BAD WORDS) METODLARI =====================
  getBadWords(guildId) {
    const settings = this.getGuildSettings(guildId);
    return Array.isArray(settings.badWords) ? settings.badWords : [];
  },

  addBadWords(guildId, words) {
    const settings = this.getGuildSettings(guildId);
    const current = Array.isArray(settings.badWords) ? [...settings.badWords] : [];
    const added = [];

    const toAdd = Array.isArray(words) ? words : [words];
    for (const w of toAdd) {
      if (typeof w !== 'string') continue;
      const clean = w.trim().toLowerCase();
      if (clean && !current.includes(clean)) {
        current.push(clean);
        added.push(clean);
      }
    }

    this.updateGuildSettings(guildId, { badWords: current, badWordsEnabled: true });
    return { added, total: current };
  },

  removeBadWord(guildId, word) {
    const settings = this.getGuildSettings(guildId);
    let current = Array.isArray(settings.badWords) ? [...settings.badWords] : [];
    const clean = (word || '').trim().toLowerCase();
    const initialLen = current.length;
    current = current.filter(w => w !== clean);
    const removed = current.length < initialLen;
    this.updateGuildSettings(guildId, { badWords: current });
    return { removed, total: current };
  },

  clearBadWords(guildId) {
    this.updateGuildSettings(guildId, { badWords: [] });
    return true;
  },

  setBadWordsEnabled(guildId, enabled) {
    this.updateGuildSettings(guildId, { badWordsEnabled: enabled });
    return enabled;
  }
};

