const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder, MessageFlags } = require('discord.js');
const logger = require('../../utils/logger');
const log = require('../../utils/log');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lock')
    .setDescription('Kanalni oddiy a\'zolar uchun yozishdan vaqtincha qulflaydi (Lockdown)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false)
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Qulflanadigan kanal (bo\'sh qolsa joriy kanal)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Qulflash sababi')
        .setRequired(false)
    ),

  async execute(interaction) {
    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
    const reason = interaction.options.getString('reason') || 'Sabab ko\'rsatilmadi';
    const guild = interaction.guild;

    // Bot ruxsatlarini tekshirish
    const botMember = guild.members.me;
    if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return interaction.reply({
        content: '❌ Botda kanallarni boshqarish (**Manage Channels**) ruxsati yo\'q!',
        flags: MessageFlags.Ephemeral
      });
    }

    try {
      // @everyone uchun SendMessages ruxsatini o'chirish
      await targetChannel.permissionOverwrites.edit(guild.roles.everyone, {
        SendMessages: false
      });

      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('🔒 Kanal Qulflandi')
        .setDescription(`Ushbu kanal ma'muriyat tomonidan vaqtincha yozish uchun qulflab qo'yildi.\n\n**Sabab:** ${reason}`)
        .setFooter({ text: `Moderator: ${interaction.user.tag}` })
        .setTimestamp();

      await targetChannel.send({ embeds: [embed] });

      await interaction.reply({
        content: `✅ <#${targetChannel.id}> kanali muvaffaqiyatli qulflandi!`,
        flags: MessageFlags.Ephemeral
      });

      await logger.logModAction(
        guild,
        'Kanal Qulflandi (/lock)',
        interaction.user,
        { name: `#${targetChannel.name}`, id: targetChannel.id },
        reason
      );
    } catch (error) {
      log.error('Lock xatosi:', error);
      await interaction.reply({
        content: `❌ Kanalni qulflashda xatolik: ${error.message}`,
        flags: MessageFlags.Ephemeral
      });
    }
  }
};
