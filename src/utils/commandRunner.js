const { MessageFlags } = require('discord.js');
const log = require('./log');

/**
 * Buyruqlar uchun umumiy qatlam (middleware).
 *
 * Ilgari har bir buyruq shunchaki `{ data, execute }` obyekti edi va
 * `interactionCreate` faqat try/catch bilan o'rab chaqirardi. Cooldown,
 * umumiy ruxsat tekshiruvi yoki vaqt o'lchash uchun joy yo'q edi.
 *
 * Bu modul buyruqning o'zini o'zgartirmaydi - faqat chaqiruv atrofida
 * zanjir hosil qiladi:  cooldown -> bajarish -> vaqt/xatolik.
 *
 * Buyruq faylida ixtiyoriy ravishda `cooldown` (soniya) e'lon qilish mumkin:
 *   module.exports = { data, cooldown: 10, async execute(...) {} };
 */

const DEFAULT_COOLDOWN_SECONDS = Number(process.env.COMMAND_COOLDOWN) || 0;

// Buyruq nomi -> (foydalanuvchi ID -> oxirgi ishlatilgan vaqt)
const cooldowns = new Map();

// Sekin buyruqlarni sezish uchun chegara
const SLOW_COMMAND_MS = Number(process.env.SLOW_COMMAND_MS) || 3000;

function cooldownSecondsFor(command) {
  const value = Number(command.cooldown);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_COOLDOWN_SECONDS;
}

/**
 * Cooldown tekshiruvi. Qolgan vaqtni (soniyada) qaytaradi, 0 bo'lsa ruxsat.
 * Tekshiruv o'tsa, vaqt darhol yangilanadi.
 */
function consumeCooldown(commandName, userId, seconds) {
  if (seconds <= 0) return 0;

  let perUser = cooldowns.get(commandName);
  if (!perUser) {
    perUser = new Map();
    cooldowns.set(commandName, perUser);
  }

  const now = Date.now();
  const readyAt = perUser.get(userId) || 0;
  if (now < readyAt) {
    return Math.ceil((readyAt - now) / 1000);
  }

  perUser.set(userId, now + seconds * 1000);
  return 0;
}

/** Foydalanuvchiga xabar yetkazish - javob berilgan/berilmaganini hisobga oladi. */
async function respond(interaction, content) {
  const payload = { content, flags: MessageFlags.Ephemeral };
  if (interaction.replied || interaction.deferred) {
    await interaction.followUp(payload).catch(() => {});
  } else {
    await interaction.reply(payload).catch(() => {});
  }
}

/**
 * Buyruqni umumiy qatlam bilan bajaradi.
 * Buyruq fayllari o'zgarmaydi - ular hamon oddiy `{ data, execute }`.
 */
async function runCommand(command, interaction, client) {
  const name = command.data?.name || interaction.commandName;

  // 1. Cooldown
  const seconds = cooldownSecondsFor(command);
  const remaining = consumeCooldown(name, interaction.user.id, seconds);
  if (remaining > 0) {
    await respond(interaction, `⏳ Bu buyruqni qayta ishlatish uchun **${remaining} soniya** kuting.`);
    return { ok: true, skipped: 'cooldown' };
  }

  // 2. Bajarish + vaqt o'lchash
  const startedAt = Date.now();
  try {
    await command.execute(interaction, client);
    const ms = Date.now() - startedAt;
    if (ms >= SLOW_COMMAND_MS) {
      log.warn(`[SEKIN BUYRUQ] /${name} ${ms}ms davom etdi`);
    } else {
      log.debug(`/${name} ${ms}ms`);
    }
    return { ok: true, ms };
  } catch (error) {
    const ms = Date.now() - startedAt;
    log.error(`Buyruq bajarilishida xatolik (/${name}, ${ms}ms):`, error);

    // Cooldown ni bo'shatamiz - bajarilmagan buyruq uchun jazo bo'lmasin
    cooldowns.get(name)?.delete(interaction.user.id);

    await respond(interaction, '❌ Ushbu buyruqni bajarishda kutilmagan xatolik yuz berdi!');
    return { ok: false, error, ms };
  }
}

/** Testlar uchun: cooldown holatini tozalash. */
function resetCooldowns() {
  cooldowns.clear();
}

module.exports = { runCommand, resetCooldowns, consumeCooldown };
