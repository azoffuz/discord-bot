const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('say')
    .setDescription('Bot nomidan kanalda oddiy xabar yuboradi (Faqat Server Egasi)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)
    .addStringOption(option =>
      option.setName('message')
        .setDescription('Yuborilishi kerak bo\'lgan xabar matni')
        .setRequired(true)
    )
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Xabar yuboriladigan kanal (bo\'sh qolsa joriy kanal)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    ),

  async execute(interaction) {
    const { guild, user } = interaction;
    const isGuildOwner = guild && guild.ownerId === user.id;
    const isBotOwner = process.env.OWNER_ID && user.id === process.env.OWNER_ID.trim();

    if (!isGuildOwner && !isBotOwner) {
      return interaction.reply({
        content: '❌ Ushbu buyruqdan foydalanish faqat Server Egasi (Server Owner) uchun cheklangan!',
        ephemeral: true
      });
    }

    const message = interaction.options.getString('message');
    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

    // Botning ruxsatlarini tekshirish
    const permissions = targetChannel.permissionsFor(guild.members.me);
    if (!permissions.has(PermissionFlagsBits.SendMessages)) {
      return interaction.reply({
        content: `❌ Mening <#${targetChannel.id}> kanalida xabar yozish uchun ruxsatim yo'q!`,
        ephemeral: true
      });
    }

    try {
      await targetChannel.send({ content: message });
      await interaction.reply({
        content: `✅ Xabar muvaffaqiyatli <#${targetChannel.id}> kanaliga yuborildi!`,
        ephemeral: true
      });

      // Audit / Moderatsiya logiga yozish
      if (logger && logger.logModAction) {
        await logger.logModAction(
          guild,
          'Bot Nomidan Xabar (/say)',
          user,
          { name: targetChannel.name, id: targetChannel.id },
          `Kanal: <#${targetChannel.id}>\nXabar: ${message.slice(0, 500)}`
        ).catch(() => {});
      }
    } catch (error) {
      console.error('Say buyrug\'i xatosi:', error);
      await interaction.reply({
        content: `❌ Xabar yuborishda xatolik: ${error.message}`,
        ephemeral: true
      });
    }
  }
};
