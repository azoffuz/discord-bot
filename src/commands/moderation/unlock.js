const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unlock')
    .setDescription('Qulflangan kanalni qayta ochadi')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false)
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Qulfdan chiqariladigan kanal (bo\'sh qolsa joriy kanal)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    ),

  async execute(interaction) {
    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
    const guild = interaction.guild;

    const botMember = guild.members.me;
    if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return interaction.reply({
        content: '❌ Botda kanallarni boshqarish (**Manage Channels**) ruxsati yo\'q!',
        ephemeral: true
      });
    }

    try {
      // @everyone uchun SendMessages ruxsatini qayta tiklash
      await targetChannel.permissionOverwrites.edit(guild.roles.everyone, {
        SendMessages: null
      });

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('🔓 Kanal Qulfdan Chiqarildi')
        .setDescription('Ushbu kanal yana hamma a\'zolar uchun yozishga ochildi.')
        .setFooter({ text: `Moderator: ${interaction.user.tag}` })
        .setTimestamp();

      await targetChannel.send({ embeds: [embed] });

      await interaction.reply({
        content: `✅ <#${targetChannel.id}> kanali muvaffaqiyatli ochildi!`,
        ephemeral: true
      });

      await logger.logModAction(
        guild,
        'Kanal Ochildi (/unlock)',
        interaction.user,
        { name: `#${targetChannel.name}`, id: targetChannel.id }
      );
    } catch (error) {
      console.error('Unlock xatosi:', error);
      await interaction.reply({
        content: `❌ Kanalni ochishda xatolik: ${error.message}`,
        ephemeral: true
      });
    }
  }
};
