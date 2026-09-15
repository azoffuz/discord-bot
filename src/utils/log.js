/**
 * Darajali (leveled) logger.
 *
 * Maqsad: prodda shovqinni kamaytirish, lekin Render paneli uchun kerakli
 * ma'lumotni yo'qotmaslik. `LOG_LEVEL` orqali boshqariladi:
 *
 *   debug | info (standart) | warn | error | silent
 *
 * `banner()` - daraja qanday bo'lishidan qat'i nazar har doim chiqadi.
 * Bot ishga tushganda ko'rsatiladigan holat bloklari (Supabase ulanishi,
 * serverlar soni) aynan shu orqali chiqariladi - ular log emas, interfeys.
 */

const LEVELS = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 99
};

const requested = String(process.env.LOG_LEVEL || 'info').toLowerCase();
const threshold = LEVELS[requested] ?? LEVELS.info;

if (!(requested in LEVELS)) {
  console.warn(`[LOG] Noma'lum LOG_LEVEL="${process.env.LOG_LEVEL}", "info" ishlatilmoqda.`);
}

function enabled(level) {
  return LEVELS[level] >= threshold;
}

module.exports = {
  LEVELS,
  level: requested in LEVELS ? requested : 'info',
  enabled,

  debug(...args) {
    if (enabled('debug')) console.log('[DEBUG]', ...args);
  },

  info(...args) {
    if (enabled('info')) console.log(...args);
  },

  warn(...args) {
    if (enabled('warn')) console.warn(...args);
  },

  error(...args) {
    if (enabled('error')) console.error(...args);
  },

  /** Har doim chiqadi - ishga tushish holati va jiddiy ogohlantirishlar uchun. */
  banner(...args) {
    console.log(...args);
  }
};
