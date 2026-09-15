module.exports = {
  name: 'guildCreate',
  async execute(guild) {
    const rawAllowed = process.env.ALLOWED_GUILD_ID || process.env.GUILD_ID || '';
    const allowedGuilds = rawAllowed
      .split(',')
      .map(id => id.trim())
      .filter(Boolean);

    // Agar maxsus server ID lari belgilangan bo'lsa va bu boshqa begona server bo'lsa
    if (allowedGuilds.length > 0) {
      if (!allowedGuilds.includes(guild.id)) {
        console.warn(`[XAVFSIZLIK] Bot ruxsatsiz serverga (${guild.name} | ${guild.id}) qo'shildi. Avtomatik chiqib ketilmoqda...`);
        try {
          await guild.leave();
        } catch (err) {
          console.error(`Serverdan chiqishda xatolik (${guild.name}):`, err.message);
        }
      }
    }
  }
};
