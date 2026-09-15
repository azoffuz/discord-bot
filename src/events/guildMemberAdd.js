const { EmbedBuilder } = require('discord.js');
const storage = require('../config/storage');
const { updateGuildStats } = require('../utils/statsUpdater');
const logger = require('../utils/logger');
const log = require('../utils/log');

module.exports = {
  name: 'guildMemberAdd',
  async execute(member) {
    const guild = member.guild;
    const settings = storage.getGuildSettings(guild.id);

    // 1. Welcome xabarini yuborish (agar yoqilgan bo'lsa)
    if (settings.welcomeEnabled && settings.welcomeChannelId) {
      const channel = await guild.channels.fetch(settings.welcomeChannelId).catch(() => null);
      if (channel && channel.isTextBased()) {
        const template = settings.welcomeMessage || 'Xush kelibsiz, {user}! Siz serverimizning {memberCount}-a\'zosisiz 🎉';
        const formatted = template
          .replace(/{user}/g, `${member}`)
          .replace(/{username}/g, member.user.username)
          .replace(/{server}/g, guild.name)
          .replace(/{memberCount}/g, guild.memberCount);

        const welcomeEmbed = new EmbedBuilder()
          .setColor(0x57F287)
          .setTitle(`🎉 Xush kelibsiz!`)
          .setDescription(formatted)
          .setThumbnail(member.user.displayAvatarURL({ size: 512 }))
          .setFooter({ text: `${guild.name} • Jami a'zolar: ${guild.memberCount}` })
          .setTimestamp();

        await channel.send({ embeds: [welcomeEmbed] }).catch(err => {
          log.error('Welcome xabari yuborishda xatolik:', err.message);
        });
      }
    }

    // 2. Auto-Role berish (agar sozlangan bo'lsa)
    if (settings.autoRoleId) {
      try {
        const role = await guild.roles.fetch(settings.autoRoleId).catch(() => null);
        if (role && guild.members.me.roles.highest.position > role.position) {
          await member.roles.add(role, 'Cleva Auto-Role tizimi');
        }
      } catch (err) {
        log.warn('Auto-role berishda xatolik:', err.message);
      }
    }

    // 3. Log kanaliga yozish
    await logger.logMemberJoin(member);

    // 4. Server statistikasini yangilash
    updateGuildStats(guild);
  }
};
