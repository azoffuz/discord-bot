const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('embed')
    .setDescription('Bot nomidan chiroyli ramkali (Embed) rasmiy e\'lon yuboradi')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false)
    .addStringOption(option =>
      option.setName('title')
        .setDescription('Embed sarlavhasi')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('description')
        .setDescription('Embed asosiy matni (yangi qator uchun \\n yozishingiz mumkin)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('color')
        .setDescription('HEX rang kodi (masalan: #5865F2, #ff0000, #00ff00)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('image')
        .setDescription('Katta rasm havolasi (URL)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('thumbnail')
        .setDescription('Kichik burchak rasmi havolasi (URL)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('footer')
        .setDescription('Embed pastki qismidagi matn')
        .setRequired(false)
    )
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Xabar yuboriladigan kanal (bo\'sh qolsa joriy kanal)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    ),

  async execute(interaction) {
    const title = interaction.options.getString('title');
    const description = interaction.options.getString('description').replace(/\\n/g, '\n');
    const colorInput = interaction.options.getString('color') || '#5865F2';
    const image = interaction.options.getString('image');
    const thumbnail = interaction.options.getString('thumbnail');
    const footer = interaction.options.getString('footer');
    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

    const permissions = targetChannel.permissionsFor(interaction.guild.members.me);
    if (!permissions.has(PermissionFlagsBits.SendMessages) || !permissions.has(PermissionFlagsBits.EmbedLinks)) {
      return interaction.reply({
        content: `❌ Mening <#${targetChannel.id}> kanaliga Embed yuborish uchun ruxsatim yetarli emas!`,
        ephemeral: true
      });
    }

    // Rangni tekshirish
    let color = 0x5865F2;
    if (colorInput) {
      const cleaned = colorInput.replace('#', '');
      const parsed = parseInt(cleaned, 16);
      if (!isNaN(parsed)) {
        color = parsed;
      }
    }

    try {
      const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .setDescription(description)
        .setTimestamp();

      if (image && image.startsWith('http')) {
        embed.setImage(image);
      }
      if (thumbnail && thumbnail.startsWith('http')) {
        embed.setThumbnail(thumbnail);
      }
      if (footer) {
        embed.setFooter({ text: footer });
      }

      await targetChannel.send({ embeds: [embed] });

      await interaction.reply({
        content: `✅ Embed xabar muvaffaqiyatli <#${targetChannel.id}> kanaliga yuborildi!`,
        ephemeral: true
      });
    } catch (error) {
      console.error('Embed buyrug\'i xatosi:', error);
      await interaction.reply({
        content: `❌ Embed yuborishda xatolik yuz berdi: ${error.message}`,
        ephemeral: true
      });
    }
  }
};
