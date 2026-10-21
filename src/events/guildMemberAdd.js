const { EmbedBuilder } = require('discord.js');
const storage = require('../config/storage');
const { updateGuildStats } = require('../utils/statsUpdater');
const { restoreLevelRoles } = require('../utils/levelManager');
const logger = require('../utils/logger');

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
          .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 512 }))
          .setFooter({ text: `${guild.name} • Jami a'zolar: ${guild.memberCount}` })
          .setTimestamp();

        await channel.send({ embeds: [welcomeEmbed] }).catch(err => {
          console.error('Welcome xabari yuborishda xatolik:', err.message);
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
        console.warn('Auto-role berishda xatolik:', err.message);
      }
    }

    // 3. Qayta qo'shilgan a'zoga daraja mukofoti rollarini qaytarish
    await restoreLevelRoles(member).catch(err => {
      console.warn('Daraja rollarini tiklashda xatolik:', err.message);
    });

    // 4. Log kanaliga yozish
    await logger.logMemberJoin(member);

    // 5. Server statistikasini yangilash
    updateGuildStats(guild);
  }
};
