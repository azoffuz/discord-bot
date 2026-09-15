const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } = require('discord.js');
const log = require('../../utils/log');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('say')
    .setDescription('Bot nomidan kanalda oddiy xabar yuboradi')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
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
    const message = interaction.options.getString('message');
    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

    // Botning ruxsatlarini tekshirish
    const permissions = targetChannel.permissionsFor(interaction.guild.members.me);
    if (!permissions.has(PermissionFlagsBits.SendMessages)) {
      return interaction.reply({
        content: `❌ Mening <#${targetChannel.id}> kanalida xabar yozish uchun ruxsatim yo'q!`,
        flags: MessageFlags.Ephemeral
      });
    }

    try {
      await targetChannel.send({ content: message });
      await interaction.reply({
        content: `✅ Xabar muvaffaqiyatli <#${targetChannel.id}> kanaliga yuborildi!`,
        flags: MessageFlags.Ephemeral
      });
    } catch (error) {
      log.error('Say buyrug\'i xatosi:', error);
      await interaction.reply({
        content: `❌ Xabar yuborishda xatolik: ${error.message}`,
        flags: MessageFlags.Ephemeral
      });
    }
  }
};
