const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

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
        leveling: {
          enabled: false,
          channelId: null,
          users: {}
        },
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
      if (!memoryCache[guildId].leveling) {
        memoryCache[guildId].leveling = {
          enabled: false,
          channelId: null,
          users: {}
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

  addXP(guildId, userId) {
    const settings = this.getGuildSettings(guildId);
    if (!settings.leveling || !settings.leveling.enabled) return null;

    if (!settings.leveling.users) settings.leveling.users = {};
    if (!settings.leveling.users[userId]) {
      settings.leveling.users[userId] = {
        xp: 0,
        level: 1,
        messages: 0,
        lastXp: 0
      };
    }

    const userData = settings.leveling.users[userId];
    const now = Date.now();

    // 60 soniyalik anti-spam cooldown (bir minutda 1 marta XP)
    if (now - (userData.lastXp || 0) < 60000) {
      userData.messages = (userData.messages || 0) + 1;
      return null;
    }

    // 15 dan 25 gacha tasodifiy XP
    const earnedXP = Math.floor(Math.random() * 11) + 15;
    userData.xp = (userData.xp || 0) + earnedXP;
    userData.messages = (userData.messages || 0) + 1;
    userData.lastXp = now;

    // Kerakli XP formulasi: level * 100
    let requiredXP = (userData.level || 1) * 100;
    let leveledUp = false;
    const oldLevel = userData.level || 1;

    while (userData.xp >= requiredXP) {
      userData.xp -= requiredXP;
      userData.level = (userData.level || 1) + 1;
      leveledUp = true;
      requiredXP = userData.level * 100;
    }

    this.updateGuildSettings(guildId, { leveling: settings.leveling });

    return {
      leveledUp,
      oldLevel,
      newLevel: userData.level,
      currentXP: userData.xp,
      requiredXP
    };
  },

  getUserLevel(guildId, userId) {
    const settings = this.getGuildSettings(guildId);
    const enabled = settings.leveling ? Boolean(settings.leveling.enabled) : false;

    if (!settings.leveling || !settings.leveling.users || !settings.leveling.users[userId]) {
      return {
        level: 1,
        xp: 0,
        requiredXP: 100,
        messages: 0,
        rank: 1,
        enabled
      };
    }

    const userData = settings.leveling.users[userId];
    const level = userData.level || 1;
    const requiredXP = level * 100;

    // Barcha a'zolarni saralash
    const allUsers = Object.entries(settings.leveling.users)
      .map(([id, data]) => ({
        id,
        level: data.level || 1,
        xp: data.xp || 0,
        messages: data.messages || 0
      }))
      .sort((a, b) => b.level - a.level || b.xp - a.xp);

    const rankIndex = allUsers.findIndex(u => u.id === userId);

    return {
      level,
      xp: userData.xp || 0,
      requiredXP,
      messages: userData.messages || 0,
      rank: rankIndex !== -1 ? rankIndex + 1 : allUsers.length + 1,
      enabled
    };
  },

  getLeaderboard(guildId, limit = 10) {
    const settings = this.getGuildSettings(guildId);
    const enabled = settings.leveling ? Boolean(settings.leveling.enabled) : false;

    if (!settings.leveling || !settings.leveling.users) {
      return { list: [], enabled };
    }

    const allUsers = Object.entries(settings.leveling.users)
      .map(([id, data]) => ({
        id,
        level: data.level || 1,
        xp: data.xp || 0,
        messages: data.messages || 0
      }))
      .sort((a, b) => b.level - a.level || b.xp - a.xp)
      .slice(0, limit);

    return {
      list: allUsers,
      enabled
    };
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
      members: {}
    };

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
        members: {}
      };
    }
    settings.activeRole = {
      ...settings.activeRole,
      ...newSettings
    };
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
  }
};
