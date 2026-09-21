/**
 * Haqoratli va Taqiqlangan So'zlar Filtri (Bad Words Filter / AutoMod)
 * Kirillcha, lotincha, leetspeak, cho'zilgan harflar va oraliq belgilarni normalizatsiya qiladi.
 */

const cyrillicToLatin = {
  'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
  'ж': 'j', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
  'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 'c', 'т': 't', 'у': 'u',
  'ф': 'f', 'х': 'x', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sh', 'ъ': "'",
  'ы': 'i', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya', 'ў': "o'", 'қ': 'q',
  'ғ': "g'", 'ҳ': 'h',
  // Ko'p uchraydigan leetspeak belgilari
  '@': 'a', '0': 'o', '1': 'i', '3': 'e', '$': 's'
};

/**
 * Matnni qidiruv uchun tozalash va standart holatga keltirish
 */
function normalizeText(str) {
  if (!str) return '';
  let res = str.toLowerCase();
  res = res.replace(/[’‘`ʻʼ]/g, "'");
  res = res.replace(/[\u200B-\u200D\uFEFF]/g, '');

  let clean = '';
  for (const ch of res) {
    clean += cyrillicToLatin[ch] || ch;
  }
  return clean;
}

/**
 * Xabar ichida taqiqlangan so'z bor-yo'qligini tekshirish
 * @param {string} content - Xabar matni
 * @param {string[]} badWords - Taqiqlangan so'zlar ro'yxati
 * @returns {{ hasBadWord: boolean, matchedWord?: string }}
 */
function containsBadWord(content, badWords) {
  if (!content || !Array.isArray(badWords) || badWords.length === 0) {
    return { hasBadWord: false };
  }

  const norm = normalizeText(content);

  for (const bw of badWords) {
    if (!bw) continue;
    const cleanBw = bw.trim();
    if (!cleanBw) continue;

    const bwNorm = normalizeText(cleanBw);
    if (!bwNorm) continue;

    // 1. Bir nechta so'zdan iborat ibora bo'lsa
    if (bwNorm.includes(' ')) {
      if (norm.includes(bwNorm)) {
        return { hasBadWord: true, matchedWord: cleanBw };
      }
      continue;
    }

    const escaped = bwNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // 2. Aniq so'z yoki o'zbekcha qo'shimchalar bilan kelgan so'z (masalan: "soz", "sozlar", "sozsan")
    // Faqat 4 va undan ortiq harfli so'zlarda qo'shimchalar qidiriladi (qisqa so'zlar boshqa so'zlarni asossiz ushlab qolmasligi uchun)
    const suffixPattern = bwNorm.length >= 4 ? "[a-z0-9']*" : "";
    const wordRegex = new RegExp('(^|[^a-z0-9\']|^)' + escaped + suffixPattern + '([^a-z0-9\']|$)', 'i');
    if (wordRegex.test(norm)) {
      return { hasBadWord: true, matchedWord: cleanBw };
    }

    // 3. Oraliq belgilar bilan yashirilgan so'zlar: masalan: "s.o.z", "s o z", "s-o-z"
    const chars = bwNorm.split('').map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const obfuscatedPattern = chars.join('+[\\s._\\-*~]*');
    const obfuscatedRegex = new RegExp('(^|[^a-z0-9\'])' + obfuscatedPattern + suffixPattern + '([^a-z0-9\']|$)', 'i');
    if (obfuscatedRegex.test(norm)) {
      return { hasBadWord: true, matchedWord: cleanBw };
    }

    // 4. Cho'zilgan harflar: masalan: "sooozzzz"
    const collapsed = norm.replace(/(.)\1{2,}/g, '$1');
    if (wordRegex.test(collapsed)) {
      return { hasBadWord: true, matchedWord: cleanBw };
    }
  }

  return { hasBadWord: false };
}

module.exports = {
  normalizeText,
  containsBadWord
};
