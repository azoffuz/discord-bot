const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const storage = require('../config/storage');
const logger = require('../utils/logger');
const { checkMessageLinks, hasMediaContent } = require('../utils/linkFilter');

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    if (!message.guild || message.author.bot) return;

    const guild = message.guild;
    const settings = storage.getGuildSettings(guild.id);

    // 1. ANTI-LINK VA ANTI-INVITE TEKSHIRUVI (Domen oq ro'yxati va GIF'lar bilan)
    if (settings.antiLinkEnabled !== false) {
      const member = message.member;
      const isOwner = process.env.OWNER_ID && message.author.id === process.env.OWNER_ID.trim();
      const isStaff = member && (
        member.permissions.has(PermissionFlagsBits.Administrator) ||
        member.permissions.has(PermissionFlagsBits.ManageMessages) ||
        member.permissions.has(PermissionFlagsBits.ManageGuild)
      );

      if (!isOwner && !isStaff) {
        const linkCheck = checkMessageLinks(message.content, settings.linkWhitelist || []);
        if (linkCheck.isViolation) {
          try {
            await message.delete().catch(() => {});

            const warnMsg = await message.channel.send({
              content: `⚠️ ${message.author}, bu serverda begona havola va reklamalar yuborish taqiqlangan! (GIF va ruxsat berilgan saytlar bundan mustasno)`,
              allowedMentions: { parse: [] }
            }).catch(() => null);

            if (warnMsg) {
              setTimeout(() => {
                warnMsg.delete().catch(() => {});
              }, 5000);
            }

            await logger.logAntiLink(message, linkCheck.illegalLinks.join('\n'));
            return; // Havola yuborgan foydalanuvchiga XP berilmaydi
          } catch (err) {
            console.error('Anti-link qayta ishlashda xatolik:', err.message);
          }
        }
      }
    }

    // 2. RASM VA GIF YUBORISH RUXSATLARINI TEKSHIRISH (Media-Roles)
    const mediaRolesSetting = settings.mediaRoles;
    if (mediaRolesSetting && mediaRolesSetting.enabled && Array.isArray(mediaRolesSetting.roles) && mediaRolesSetting.roles.length > 0) {
      const member = message.member;
      const isOwner = process.env.OWNER_ID && message.author.id === process.env.OWNER_ID.trim();
      const isStaff = member && (
        member.permissions.has(PermissionFlagsBits.Administrator) ||
        member.permissions.has(PermissionFlagsBits.ManageMessages) ||
        member.permissions.has(PermissionFlagsBits.ManageGuild)
      );

      if (!isOwner && !isStaff) {
        const hasPermittedRole = member && mediaRolesSetting.roles.some(roleId => member.roles.cache.has(roleId));

        if (!hasPermittedRole) {
          const mediaCheck = hasMediaContent(message);
          if (mediaCheck.hasMedia) {
            try {
              await message.delete().catch(() => {});

              const roleNames = mediaRolesSetting.roles
                .map(rId => {
                  const role = guild.roles.cache.get(rId);
                  return role ? `\`@${role.name}\`` : null;
                })
                .filter(Boolean)
                .join(', ') || 'maxsus rollar';

              const warnMsg = await message.channel.send({
                content: `⚠️ ${message.author}, bu serverda rasm va GIF yuborish faqat belgilangan rollar (${roleNames}) uchun ruxsat etilgan!`,
                allowedMentions: { parse: [] }
              }).catch(() => null);

              if (warnMsg) {
                setTimeout(() => {
                  warnMsg.delete().catch(() => {});
                }, 5000);
              }

              // Moderatsiya loglariga yozish
              const detail = mediaCheck.type === 'attachment'
                ? 'Biriktirilgan rasm/video fayl'
                : (mediaCheck.link ? `GIF/Media havolasi: ${mediaCheck.link}` : 'GIF xabari');

              await logger.logModAction(
                guild,
                'Ruxsatsiz Rasm/GIF to\'xtatildi',
                guild.client.user,
                message.author,
                'Foydalanuvchida rasm/GIF yuborish uchun maxsus rol yo\'q',
                `Kanal: <#${message.channel.id}>\nTuri: ${detail}`
              ).catch(() => {});

              return; // Media yuborgan ruxsatsiz foydalanuvchiga XP berilmaydi
            } catch (err) {
              console.error('Media roles tekshirishda xatolik:', err.message);
            }
          }
        }
      }
    }

    // 3. LEVEL & XP TIZIMI (Agar faollashtirilgan bo'lsa)
    if (settings.leveling && settings.leveling.enabled) {
      const xpResult = storage.addXP(guild.id, message.author.id);
      if (xpResult && xpResult.leveledUp) {
        const notifyChannelId = settings.leveling.channelId;
        const targetChannel = notifyChannelId ? guild.channels.cache.get(notifyChannelId) : message.channel;

        if (targetChannel && targetChannel.isTextBased()) {
          const levelEmbed = new EmbedBuilder()
            .setColor(0xFEE75C)
            .setTitle('🎉 Daraja Ko\'tarildi!')
            .setDescription(`Ajoyib faollik, ${message.author}! Siz **${xpResult.newLevel}-darajaga** erishdingiz! 🚀`)
            .setThumbnail(message.author.displayAvatarURL({ dynamic: true, size: 256 }))
            .setFooter({ text: `Cleva Leveling • Keyingi darajagacha: ${xpResult.requiredXP} XP` })
            .setTimestamp();

          targetChannel.send({ embeds: [levelEmbed] }).catch(() => {});
        }
      }
    }

    // 4. KUNLIK FAOLLIK ROLI TIZIMI (Active Role)
    const { handleMessage: trackActiveMessage } = require('../utils/activityTracker');
    await trackActiveMessage(message).catch(() => {});
  }
};
