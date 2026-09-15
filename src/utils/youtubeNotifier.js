/**
 * YouTube Avto-Xabarnoma (YouTube Notifier) Moduli
 * YouTube kanallarini bepul rasmiy RSS/Atom feed orqali kuzatib boradi
 * va yangi video yoki Shorts chiqqanda Discord kanaliga avtomat e'lon qiladi.
 */

const storage = require('../config/storage');

/**
 * YouTube kanal nomini, havolasini yoki handlesini Channel ID ga aylantirish
 */
async function resolveYouTubeChannel(input) {
  if (!input) return null;
  let cleaned = input.trim();

  // 1. Agar to'g'ridan-to'g'ri Channel ID berilgan bo'lsa (UC...)
  if (cleaned.startsWith('UC') && cleaned.length >= 24) {
    try {
      const feedRes = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${cleaned}`);
      if (feedRes.ok) {
        const xml = await feedRes.text();
        const authorMatch = xml.match(/<name>(.*?)<\/name>/);
        const title = authorMatch ? authorMatch[1] : 'YouTube Kanal';
        return {
          channelId: cleaned,
          channelTitle: title,
          channelUrl: `https://www.youtube.com/channel/${cleaned}`
        };
      }
    } catch {}
    return {
      channelId: cleaned,
      channelTitle: 'YouTube Kanal',
      channelUrl: `https://www.youtube.com/channel/${cleaned}`
    };
  }

  // 2. Havolani to'g'rilash
  let url = cleaned;
  if (!url.startsWith('http')) {
    if (url.startsWith('@')) {
      url = 'https://www.youtube.com/' + url;
    } else {
      url = 'https://www.youtube.com/@' + url;
    }
  }

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    if (!res.ok) return null;
    const text = await res.text();

    let channelId = null;
    let channelTitle = null;

    // Meta taglarni qidirish
    const metaMatch = text.match(/itemprop=["']channelId["']\s+content=["'](UC[^"']+)["']/i) ||
                      text.match(/content=["'](UC[^"']+)["']\s+itemprop=["']channelId["']/i);
    if (metaMatch) channelId = metaMatch[1];

    if (!channelId) {
      const browseMatch = text.match(/"browseId":\s*"(UC[^"]+)"/);
      if (browseMatch) channelId = browseMatch[1];
    }

    if (!channelId) {
      const urlMatch = text.match(/https:\/\/www\.youtube\.com\/channel\/(UC[a-zA-Z0-9_-]{20,})/);
      if (urlMatch) channelId = urlMatch[1];
    }

    const titleMatch = text.match(/<meta property=["']og:title["']\s+content=["']([^"']+)["']/i) ||
                       text.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch) {
      channelTitle = titleMatch[1].replace(' - YouTube', '').trim();
    }

    if (channelId) {
      return {
        channelId,
        channelTitle: channelTitle || 'YouTube Kanal',
        channelUrl: url
      };
    }

    return null;
  } catch (err) {
    console.error('[YOUTUBE RESOLVE XATOSI]:', err.message);
    return null;
  }
}

/**
 * YouTube kanalining RSS feedidan so'nggi videolarni olish
 */
async function fetchLatestVideos(channelId) {
  if (!channelId) return [];
  const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;

  try {
    const res = await fetch(feedUrl);
    if (!res.ok) return [];
    const xml = await res.text();

    const entries = [];
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    let match;

    while ((match = entryRegex.exec(xml)) !== null) {
      const entryXml = match[1];
      const idMatch = entryXml.match(/<yt:videoId>(.*?)<\/yt:videoId>/);
      const titleMatch = entryXml.match(/<title>(.*?)<\/title>/);
      const linkMatch = entryXml.match(/<link rel=["']alternate["'] href=["'](.*?)["']/);
      const publishedMatch = entryXml.match(/<published>(.*?)<\/published>/);
      const authorMatch = entryXml.match(/<name>(.*?)<\/name>/);

      if (idMatch) {
        entries.push({
          videoId: idMatch[1],
          title: titleMatch ? titleMatch[1] : 'Yangi Video',
          link: linkMatch ? linkMatch[1] : `https://www.youtube.com/watch?v=${idMatch[1]}`,
          published: publishedMatch ? publishedMatch[1] : new Date().toISOString(),
          author: authorMatch ? authorMatch[1] : 'YouTube Kanal'
        });
      }
    }

    return entries;
  } catch (err) {
    console.error('[YOUTUBE FEED XATOSI]:', err.message);
    return [];
  }
}

/**
 * Barcha serverlardagi YouTube yangilanishlarini tekshirish
 */
async function checkYouTubeUpdates(client) {
  if (!client || !client.guilds) return;

  for (const [guildId, guild] of client.guilds.cache) {
    try {
      const settings = storage.getGuildSettings(guildId);
      const yt = settings.youtubeNotifier;

      if (!yt || !yt.enabled || !yt.youtubeChannelId || !yt.channelId) {
        continue;
      }

      const videos = await fetchLatestVideos(yt.youtubeChannelId);
      if (!videos || videos.length === 0) continue;

      const latestVideo = videos[0];

      // 1. Agar birinchi marta sozlangan bo'lsa, faqat lastVideoId ni saqlab qo'yamiz (spam qilmaslik uchun)
      if (!yt.lastVideoId) {
        storage.updateGuildSettings(guildId, {
          youtubeNotifier: {
            ...yt,
            lastVideoId: latestVideo.videoId
          }
        });
        continue;
      }

      // 2. Agar yangi video chiqqan bo'lsa
      if (latestVideo.videoId !== yt.lastVideoId) {
        const discordChannel = guild.channels.cache.get(yt.channelId) ||
          await guild.channels.fetch(yt.channelId).catch(() => null);

        if (discordChannel && discordChannel.isTextBased()) {
          const pingStr = yt.pingRoleId
            ? (yt.pingRoleId === 'everyone' ? '@everyone' : `<@&${yt.pingRoleId}>`)
            : '';

          let msgTemplate = yt.customMessage ||
            '🔴 **{author}** yangi video yukladi!\n\n{ping}\n**{title}**\n{link}';

          let messageContent = msgTemplate
            .replace(/{author}/g, latestVideo.author)
            .replace(/{title}/g, latestVideo.title)
            .replace(/{link}/g, latestVideo.link)
            .replace(/{ping}/g, pingStr)
            .trim();

          await discordChannel.send({ content: messageContent }).catch(err => {
            console.error(`[YOUTUBE SEND ERROR] (${guild.name}):`, err.message);
          });

          // Bazada oxirgi video ID sini yangilash
          storage.updateGuildSettings(guildId, {
            youtubeNotifier: {
              ...yt,
              lastVideoId: latestVideo.videoId
            }
          });

          console.log(`[YOUTUBE NOTIFIER] Yangi video yuborildi: "${latestVideo.title}" (${guild.name})`);
        }
      }
    } catch (err) {
      console.error(`[YOUTUBE CHECK ERROR] (${guild.name}):`, err.message);
    }
  }
}

/**
 * Sozlamalarni test qilish uchun xabar yuborish
 */
async function sendTestNotification(guild, targetChannelId, ytSettings) {
  const discordChannel = guild.channels.cache.get(targetChannelId) ||
    await guild.channels.fetch(targetChannelId).catch(() => null);

  if (!discordChannel || !discordChannel.isTextBased()) {
    return { success: false, error: 'Belgilangan kanal topilmadi yoki matnli kanal emas.' };
  }

  const videos = await fetchLatestVideos(ytSettings.youtubeChannelId);
  if (!videos || videos.length === 0) {
    return { success: false, error: 'YouTube kanalidan videolar olinmadi. Kanal ID sini tekshiring.' };
  }

  const testVideo = videos[0];
  const pingStr = ytSettings.pingRoleId
    ? (ytSettings.pingRoleId === 'everyone' ? '@everyone' : `<@&${ytSettings.pingRoleId}>`)
    : '';

  let msgTemplate = ytSettings.customMessage ||
    '🔴 **{author}** yangi video yukladi!\n\n{ping}\n**{title}**\n{link}';

  let messageContent = '🧪 **[TEST XABARNOMA]**\n' + msgTemplate
    .replace(/{author}/g, testVideo.author)
    .replace(/{title}/g, testVideo.title)
    .replace(/{link}/g, testVideo.link)
    .replace(/{ping}/g, pingStr)
    .trim();

  await discordChannel.send({ content: messageContent });
  return { success: true, video: testVideo };
}

/**
 * Bot ishga tushganda orqa fonda har 5 daqiqada tekshiruvchini sozlash
 */
function initYouTubeNotifier(client) {
  // Bot yoqqanidan 10 soniya o'tib dastlabki tekshiruv
  setTimeout(() => {
    checkYouTubeUpdates(client);
  }, 10_000);

  // Har 5 daqiqada yangi videolarni tekshirish (YouTube RSS uchun optimal)
  setInterval(() => {
    checkYouTubeUpdates(client);
  }, 5 * 60 * 1000);
}

module.exports = {
  resolveYouTubeChannel,
  fetchLatestVideos,
  checkYouTubeUpdates,
  sendTestNotification,
  initYouTubeNotifier
};
