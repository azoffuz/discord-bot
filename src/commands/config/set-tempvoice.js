const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder, MessageFlags } = require('discord.js');
const storage = require('../../config/storage');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set-tempvoice')
    .setDescription('Avtomatik shaxsiy ovozli xonalar ("Join to Create") tizimini sozlash')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option
        .setName('status')
        .setDescription('Shaxsiy ovozli xonalar tizimini yoqish yoki o\'chirish')
        .setRequired(true)
        .addChoices(
          { name: '✅ Yoqish ("➕ Xona Yaratish" kanalini ochish)', value: 'enable' },
          { name: '❌ O\'chirish (Tizim va kanallarni olib tashlash)', value: 'disable' }
        )
    ),

  async execute(interaction) {
    const isOwner = process.env.OWNER_ID && interaction.user.id === process.env.OWNER_ID.trim();
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator) &&
        !interaction.member.permissions.has(PermissionFlagsBits.ManageGuild) &&
        !isOwner) {
      return interaction.reply({
        content: '❌ Ushbu buyruqdan foydalanish uchun sizda `Administrator` yoki `Manage Server` ruxsati bo\'lishi kerak.',
        flags: MessageFlags.Ephemeral
      });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const statusChoice = interaction.options.getString('status');
    const guild = interaction.guild;
    const settings = storage.getGuildSettings(guild.id);

    if (statusChoice === 'disable') {
      if (!settings.tempVoice || !settings.tempVoice.enabled) {
        return interaction.editReply({
          content: 'ℹ️ Shaxsiy ovozli xonalar tizimi allaqachon o\'chirilgan holatda.'
        });
      }

      const { categoryId, channelId } = settings.tempVoice;

      if (channelId) {
        const ch = guild.channels.cache.get(channelId);
        if (ch) await ch.delete().catch(() => {});
      }
      if (categoryId) {
        const cat = guild.channels.cache.get(categoryId);
        if (cat) await cat.delete().catch(() => {});
      }

      storage.updateGuildSettings(guild.id, {
        tempVoice: {
          enabled: false,
          categoryId: null,
          channelId: null
        }
      });

      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('🔊 Shaxsiy Ovozli Xonalar O\'chirildi')
        .setDescription('Avtomatik ovozli xonalar tizimi va "➕ Xona Yaratish" kanali olib tashlandi.')
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    // ENABLE HOLATI
    try {
      // Kategoriya yaratish
      const category = await guild.channels.create({
        name: '🔊・OVOZLI XONALAR',
        type: ChannelType.GuildCategory
      });

      // Asosiy "➕・Xona Yaratish" ovozli kanali
      const createChannel = await guild.channels.create({
        name: '➕・Xona Yaratish',
        type: ChannelType.GuildVoice,
        parent: category.id
      });

      storage.updateGuildSettings(guild.id, {
        tempVoice: {
          enabled: true,
          categoryId: category.id,
          channelId: createChannel.id
        }
      });

      const successEmbed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('🔊 Shaxsiy Ovozli Xonalar Tizimi Faollashdi!')
        .setDescription(
          '**Avtomatik ovozli xonalar ("Join to Create") tizimi muvaffaqiyatli yoqildi!**\n\n' +
          `📁 **Kategoriya:** ${category.name}\n` +
          `🎙️ **Boshlang'ich kanal:** <#${createChannel.id}>\n\n` +
          '💡 **Qanday ishlaydi?**\n' +
          'A\'zo ushbu kanalga kirishi bilan bot unga alohida shaxsiy ovozli xona ochib beradi va uni avtomatik ko\'chiradi. Xonadagi hamma chiqib ketgach, xona avtomatik o\'chiriladi.'
        )
        .setFooter({ text: 'O\'chirish uchun: /set-tempvoice status:O\'chirish' })
        .setTimestamp();

      return interaction.editReply({ embeds: [successEmbed] });
    } catch (err) {
      console.error('[SET-TEMPVOICE XATOSI]:', err);
      return interaction.editReply({
        content: `❌ Tizimni sozlashda xatolik yuz berdi: ${err.message}`
      });
    }
  }
};
