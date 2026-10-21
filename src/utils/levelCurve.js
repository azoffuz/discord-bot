// ===================== DARAJA EGRI CHIZIG'I (YAGONA MANBA) =====================
// Saqlanadigan yagona haqiqat - foydalanuvchining jami XP si (totalXp).
// Daraja va darajadagi progress har doim shu yerdan hisoblanadi, shuning uchun
// formulani keyinchalik o'zgartirish hech kimning XP sini yo'qotmaydi.
//
// Daraja 1 dan boshlanadi. L -> L+1 ga o'tish narxi: 5n² + 50n + 100 (n = L - 1).
// Boshlang'ich darajalar tez, yuqori darajalar esa sekin-asta qimmatlashadi.

const MIN_LEVEL = 1;

// Xabar uchun XP: har daqiqada bir marta, min..max oralig'ida tasodifiy
const MESSAGE_XP = { min: 15, max: 25, cooldownMs: 60000 };

// Ovozli xona uchun XP: shartlarga mos har bir daqiqa uchun
const VOICE_XP = { perMinute: 10 };

/** L-darajadan L+1 ga o'tish uchun kerakli XP */
function xpToNext(level) {
  const n = Math.max(MIN_LEVEL, level) - 1;
  return 5 * n * n + 50 * n + 100;
}

/** L-darajaga yetish uchun kerakli jami XP (1-daraja = 0 XP) */
function totalXpForLevel(level) {
  const n = Math.max(MIN_LEVEL, level) - 1; // 0..n-1 oraliqdagi narxlar yig'indisi
  return (5 * (n - 1) * n * (2 * n - 1)) / 6 + 25 * n * (n - 1) + 100 * n;
}

/** Jami XP dan darajani hisoblaydi */
function levelFromXp(totalXp) {
  let level = MIN_LEVEL;
  let remaining = Math.max(0, totalXp || 0);
  while (remaining >= xpToNext(level)) {
    remaining -= xpToNext(level);
    level++;
  }
  return level;
}

/**
 * Jami XP bo'yicha to'liq holat:
 * level - daraja, xp - shu darajada to'plangan XP, requiredXP - keyingi
 * darajaga o'tish narxi, remainingXP - keyingi darajagacha qolgan XP.
 */
function progress(totalXp) {
  const total = Math.max(0, totalXp || 0);
  const level = levelFromXp(total);
  const xp = total - totalXpForLevel(level);
  const requiredXP = xpToNext(level);
  return { level, xp, requiredXP, remainingXP: requiredXP - xp, totalXp: total };
}

/**
 * Eski formuladan (L -> L+1 = L * 100, XP har darajada nolga tushadi)
 * ko'chirish. Daraja saqlanadi - hech kim darajasini yo'qotmaydi; joriy
 * darajadagi progress esa foiz sifatida yangi narxga o'tkaziladi.
 */
function totalXpFromLegacy(level, xp) {
  const lvl = Math.max(MIN_LEVEL, Math.floor(level || MIN_LEVEL));
  const fraction = Math.min(0.999, Math.max(0, (xp || 0) / (lvl * 100)));
  return totalXpForLevel(lvl) + Math.floor(fraction * xpToNext(lvl));
}

// ===================== HAFTALIK / OYLIK DAVRLAR =====================
// Davr kalitlari Toshkent vaqti (UTC+5) bo'yicha - kunlik faollik tizimi bilan bir xil.
// Hafta dushanbadan boshlanadi. Kalit o'zgarsa davr hisoblagichlari nolga tushadi.

const TASHKENT_OFFSET_MS = 5 * 3600000;

function periodKeys(now = Date.now()) {
  const local = new Date(now + TASHKENT_OFFSET_MS);
  const daysSinceMonday = (local.getUTCDay() + 6) % 7;
  const monday = new Date(local.getTime() - daysSinceMonday * 86400000);
  return {
    week: monday.toISOString().slice(0, 10),
    month: local.toISOString().slice(0, 7)
  };
}

module.exports = {
  MIN_LEVEL,
  MESSAGE_XP,
  VOICE_XP,
  xpToNext,
  totalXpForLevel,
  levelFromXp,
  progress,
  totalXpFromLegacy,
  periodKeys
};
