const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { ChannelType } = require('discord.js');
const storage = require('../config/storage');

// Zaxira fayllari saqlanadigan joy (data/ .gitignore da, shuning uchun repoga tushmaydi)
const DATA_DIR = path.join(__dirname, '../../data');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const BACKUP_VERSION = 1;

// Faqat bot yarata oladigan kanal turlari (Directery/Store kabi turlar tashlanadi)
const CREATABLE_TYPES = new Set([
  ChannelType.GuildText,
  ChannelType.GuildVoice,
  ChannelType.GuildCategory,
  ChannelType.GuildAnnouncement,
  ChannelType.GuildStageVoice,
  ChannelType.GuildForum
]);

const TEXT_LIKE = new Set([ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildForum]);
const VOICE_LIKE = new Set([ChannelType.GuildVoice, ChannelType.GuildStageVoice]);

// ===================== SERIALIZATSIYA (server -> JSON) =====================

function serializeRole(role) {
  return {
    name: role.name,
    color: role.hexColor,
    hoist: role.hoist,
    mentionable: role.mentionable,
    position: role.position,
    permissions: role.permissions.toArray()
  };
}

function serializeOverwrites(channel, guild) {
  const out = [];
  for (const ow of channel.permissionOverwrites.cache.values()) {
    if (ow.type === 0) {
      // Rolga tegishli ruxsat - nom bo'yicha saqlanadi (ID serverdan serverga o'zgaradi)
      const role = guild.roles.cache.get(ow.id);
      const roleName = ow.id === guild.id ? '@everyone' : (role ? role.name : null);
      if (!roleName) continue;
      out.push({
        type: 'role',
        roleName,
        allow: ow.allow.toArray(),
        deny: ow.deny.toArray()
      });
    } else {
      // A'zoga tegishli ruxsat - ID bo'yicha saqlanadi
      out.push({
        type: 'member',
        userId: ow.id,
        allow: ow.allow.toArray(),
        deny: ow.deny.toArray()
      });
    }
  }
  return out;
}

function serializeChannel(channel, guild) {
  const data = {
    name: channel.name,
    type: channel.type,
    position: channel.position,
    parentName: channel.parent ? channel.parent.name : null,
    permissionOverwrites: serializeOverwrites(channel, guild)
  };

  if (TEXT_LIKE.has(channel.type)) {
    data.topic = channel.topic || null;
    data.nsfw = Boolean(channel.nsfw);
    data.rateLimitPerUser = channel.rateLimitPerUser || 0;
  }
  if (VOICE_LIKE.has(channel.type)) {
    data.userLimit = channel.userLimit || 0;
    data.bitrate = channel.bitrate || 64000;
  }

  return data;
}

/**
 * Server tuzilmasi + bot sozlamalarini bitta JSON obyektga yig'adi.
 * `sections` orqali qaysi bo'limlar qo'shilishini boshqarish mumkin.
 */
function serializeGuild(guild, { sections } = {}) {
  const include = {
    roles: sections?.roles !== false,
    channels: sections?.channels !== false,
    settings: sections?.settings !== false,
    emojis: sections?.emojis === true
  };

  const data = {
    meta: {
      version: BACKUP_VERSION,
      createdAt: new Date().toISOString(),
      botName: 'Cleva',
      guildId: guild.id,
      guildName: guild.name,
      guildIcon: guild.iconURL({ size: 256 }) || null,
      counts: { roles: 0, channels: 0, emojis: 0 }
    },
    sections: include,
    guild: {
      name: guild.name,
      verificationLevel: guild.verificationLevel,
      explicitContentFilter: guild.explicitContentFilter,
      defaultMessageNotifications: guild.defaultMessageNotifications,
      afkTimeout: guild.afkTimeout
    }
  };

  if (include.roles) {
    data.roles = guild.roles.cache
      .filter(r => r.id !== guild.id && !r.managed)
      .sort((a, b) => a.position - b.position)
      .map(serializeRole);
    data.meta.counts.roles = data.roles.length;
  }

  if (include.channels) {
    data.channels = guild.channels.cache
      .filter(c => CREATABLE_TYPES.has(c.type))
      .sort((a, b) => a.position - b.position)
      .map(c => serializeChannel(c, guild));
    data.meta.counts.channels = data.channels.length;
  }

  if (include.emojis) {
    data.emojis = guild.emojis.cache.map(e => ({
      name: e.name,
      animated: e.animated,
      url: e.imageURL()
    }));
    data.meta.counts.emojis = data.emojis.length;
  }

  if (include.settings) {
    data.settings = storage.getGuildSettings(guild.id);
  }

  return data;
}

// ===================== FAYL BOSHQARUVI =====================

function ensureDirSync() {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

function makeStamp() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

// Path traversal ning oldini olish uchun faqat xavfsiz belgilar
const ID_RE = /^[A-Za-z0-9._-]+$/;
function isValidId(id) {
  return typeof id === 'string' && id.length > 0 && ID_RE.test(id) && !id.includes('..');
}

function backupPath(id) {
  return path.join(BACKUP_DIR, `${id}.json`);
}

async function saveBackup(guild, data) {
  ensureDirSync();
  const json = JSON.stringify(data, null, 2);
  const stamp = makeStamp();

  let id = `${stamp}-${guild.id}`;
  let n = 1;
  while (fs.existsSync(backupPath(id))) {
    id = `${stamp}-${guild.id}-${n++}`;
  }

  await fsp.writeFile(backupPath(id), json, 'utf8');
  return { id, size: Buffer.byteLength(json, 'utf8') };
}

async function listBackups(limit = 25) {
  try {
    ensureDirSync();
    const files = (await fsp.readdir(BACKUP_DIR)).filter(f => f.endsWith('.json'));
    files.sort().reverse();

    const out = [];
    for (const f of files.slice(0, limit)) {
      const id = f.replace(/\.json$/, '');
      let meta = null;
      try {
        const raw = await fsp.readFile(path.join(BACKUP_DIR, f), 'utf8');
        meta = JSON.parse(raw).meta || null;
      } catch {
        meta = null;
      }
      out.push({ id, meta, file: f });
    }
    return out;
  } catch {
    return [];
  }
}

async function readBackup(id) {
  if (!isValidId(id)) throw new Error('Noto\'g\'ri zaxira ID formati.');
  const raw = await fsp.readFile(backupPath(id), 'utf8');
  return JSON.parse(raw);
}

async function deleteBackup(id) {
  if (!isValidId(id)) return false;
  try {
    await fsp.unlink(backupPath(id));
    return true;
  } catch {
    return false;
  }
}

// ===================== TIKLASH (JSON -> server) =====================

function buildOverwrites(list, guild, roleByName) {
  const out = [];
  for (const ow of Array.isArray(list) ? list : []) {
    if (ow.type === 'role') {
      const id = ow.roleName === '@everyone'
        ? guild.id
        : roleByName.get(ow.roleName)?.id;
      if (!id) continue;
      out.push({ id, allow: ow.allow || [], deny: ow.deny || [] });
    } else if (ow.type === 'member') {
      // A'zo hali serverda bo'lmasa, uning ruxsat yozuvi tashlanadi
      if (!ow.userId || !guild.members.cache.has(ow.userId)) continue;
      out.push({ id: ow.userId, allow: ow.allow || [], deny: ow.deny || [] });
    }
  }
  return out;
}

function channelKey(type, parentId, name) {
  return `${type}:${parentId || ''}:${name}`;
}

async function applyBackup(guild, data) {
  const result = {
    rolesCreated: 0,
    rolesSkipped: 0,
    channelsCreated: 0,
    channelsSkipped: 0,
    emojisCreated: 0,
    settingsApplied: false,
    warnings: [],
    errors: []
  };

  // 1. ROLLAR (nom bo'yicha mavjudlarini saqlab, yetishmayotganini yaratamiz)
  const roleByName = new Map([['@everyone', guild.roles.everyone]]);
  for (const role of guild.roles.cache.values()) {
    if (!roleByName.has(role.name)) roleByName.set(role.name, role);
  }

  if (Array.isArray(data.roles)) {
    const sorted = [...data.roles].sort((a, b) => (a.position || 0) - (b.position || 0));
    for (const r of sorted) {
      if (!r.name || r.name === '@everyone') continue;
      if (roleByName.has(r.name)) {
        result.rolesSkipped++;
        continue;
      }
      try {
        const created = await guild.roles.create({
          name: r.name,
          color: r.color && r.color !== '#000000' ? r.color : undefined,
          hoist: Boolean(r.hoist),
          mentionable: Boolean(r.mentionable),
          permissions: Array.isArray(r.permissions) ? r.permissions : [],
          reason: 'Cleva: zaxiradan tiklash'
        });
        roleByName.set(created.name, created);
        result.rolesCreated++;
      } catch (err) {
        result.errors.push(`Rol "${r.name}": ${err.message}`);
      }
    }
  }

  // 2. KANALLAR VA KATEGORIYALAR
  if (Array.isArray(data.channels)) {
    const categoryByName = new Map();
    for (const ch of guild.channels.cache.values()) {
      if (ch.type === ChannelType.GuildCategory && !categoryByName.has(ch.name)) {
        categoryByName.set(ch.name, ch);
      }
    }

    const existing = new Set(
      [...guild.channels.cache.values()].map(ch => channelKey(ch.type, ch.parentId, ch.name))
    );

    const createChannel = async (c) => {
      const parent = c.parentName ? categoryByName.get(c.parentName) : null;
      const key = channelKey(c.type, parent ? parent.id : '', c.name);
      if (existing.has(key)) {
        result.channelsSkipped++;
        return;
      }

      const opts = { name: c.name, type: c.type, reason: 'Cleva: zaxiradan tiklash' };
      if (parent) opts.parent = parent.id;

      if (TEXT_LIKE.has(c.type)) {
        if (c.topic) opts.topic = c.topic;
        if (c.nsfw) opts.nsfw = true;
        if (c.rateLimitPerUser) opts.rateLimitPerUser = c.rateLimitPerUser;
      }
      if (VOICE_LIKE.has(c.type)) {
        if (c.userLimit) opts.userLimit = c.userLimit;
        if (c.bitrate) opts.bitrate = c.bitrate;
      }

      const overwrites = buildOverwrites(c.permissionOverwrites, guild, roleByName);
      if (overwrites.length) opts.permissionOverwrites = overwrites;

      try {
        const created = await guild.channels.create(opts);
        existing.add(channelKey(created.type, created.parentId, created.name));
        if (created.type === ChannelType.GuildCategory && !categoryByName.has(created.name)) {
          categoryByName.set(created.name, created);
        }
        result.channelsCreated++;
      } catch (err) {
        result.errors.push(`Kanal "${c.name}": ${err.message}`);
      }
    };

    const categories = data.channels.filter(c => c.type === ChannelType.GuildCategory);
    const rest = data.channels
      .filter(c => c.type !== ChannelType.GuildCategory)
      .sort((a, b) => (a.position || 0) - (b.position || 0));

    for (const cat of categories) await createChannel(cat);
    for (const ch of rest) await createChannel(ch);
  }

  // 3. EMOJILAR (nom bo'yicha mavjudlarini o'tkazib yuboramiz)
  if (Array.isArray(data.emojis)) {
    const names = new Set(guild.emojis.cache.map(e => e.name));
    for (const e of data.emojis) {
      if (!e.name || !e.url || names.has(e.name)) continue;
      try {
        await guild.emojis.create({ attachment: e.url, name: e.name, reason: 'Cleva: zaxiradan tiklash' });
        names.add(e.name);
        result.emojisCreated++;
      } catch (err) {
        result.errors.push(`Emoji "${e.name}": ${err.message}`);
      }
    }
  }

  // 4. BOT SOZLAMALARI (welcome, log, ticket, anti-link va h.k.)
  if (data.settings && typeof data.settings === 'object') {
    try {
      if (data.meta?.guildId && data.meta.guildId !== guild.id) {
        result.warnings.push(
          'Zaxira boshqa serverdan olingan: kanal/rol ID lariga bog\'liq sozlamalar ' +
          '(log, ticket, welcome va h.k.) qo\'lda qayta sozlanishi kerak.'
        );
      }
      storage.updateGuildSettings(guild.id, data.settings);
      result.settingsApplied = true;
    } catch (err) {
      result.errors.push(`Sozlamalar: ${err.message}`);
    }
  }

  return result;
}

module.exports = {
  BACKUP_DIR,
  serializeGuild,
  saveBackup,
  listBackups,
  readBackup,
  deleteBackup,
  applyBackup
};
