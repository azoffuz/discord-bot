const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('server-info')
    .setDescription('Server haqida to\'liq ma\'lumotlar va statistika')
    .setDMPermission(false),

  async execute(interaction) {
    const guild = interaction.guild;
    await interaction.deferReply();

    // A'zolarni yuklab olish (aniq insonlar va botlar soni uchun)
    const members = await guild.members.fetch().catch(() => guild.members.cache);
    const totalMembers = guild.memberCount;
    const botCount = members.filter(m => m.user.bot).size;
    const humanCount = totalMembers - botCount;

    // Kanallar turlari
    const channels = guild.channels.cache;
    const textChannels = channels.filter(c => c.type === ChannelType.GuildText).size;
    const voiceChannels = channels.filter(c => c.type === ChannelType.GuildVoice).size;
    const categories = channels.filter(c => c.type === ChannelType.GuildCategory).size;
    const forumChannels = channels.filter(c => c.type === ChannelType.GuildForum).size;

    // Rollar va emojilar
    const roleCount = guild.roles.cache.size - 1; // @everyone hisobga olinmaydi
    const emojiCount = guild.emojis.cache.size;
    const stickerCount = guild.stickers.cache.size;

    // Xavfsizlik darajasi
    const verificationLevels = {
      0: 'Hech qanday (None)',
      1: 'Past (Email tasdiqlangan)',
      2: 'O\'rta (5 daqiqadan ko\'p ro\'yxatdan o\'tgan)',
      3: 'Yuqori (10 daqiqadan ko\'p server a\'zosi)',
      4: 'Juda yuqori (Telefon raqam tasdiqlangan)'
    };

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`🏰 ${guild.name} — Server Ma'lumotlari`)
      .setThumbnail(guild.iconURL({ dynamic: true, size: 1024 }))
      .addFields(
        {
          name: '👑 Server Egasi',
          value: `<@${guild.ownerId}>`,
          inline: true
        },
        {
          name: '🆔 Server ID',
          value: `\`${guild.id}\``,
          inline: true
        },
        {
          name: '📅 Yaratilgan Sana',
          value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:d> (<t:${Math.floor(guild.createdTimestamp / 1000)}:R>)`,
          inline: false
        },
        {
          name: '👥 A\'zolar Statistikasi',
          value: `• Jami: **${totalMembers}** ta\n• Odamlar: **${humanCount}** ta\n• Botlar: **${botCount}** ta`,
          inline: true
        },
        {
          name: '💬 Kanallar Statistikasi',
          value: `• Jami: **${channels.size}** ta\n• Matnli: **${textChannels}** ta\n• Ovozli: **${voiceChannels}** ta\n• Kategoriyalar: **${categories}** ta${forumChannels ? `\n• Forumlar: **${forumChannels}** ta` : ''}`,
          inline: true
        },
        {
          name: '✨ Server Boosti',
          value: `• Daraja (Tier): **${guild.premiumTier}**\n• Boostlar: **${guild.premiumSubscriptionCount || 0}** ta`,
          inline: true
        },
        {
          name: '🎭 Rollar va Emojilar',
          value: `• Rollar: **${roleCount}** ta\n• Emojilar: **${emojiCount}** ta\n• Stickerlar: **${stickerCount}** ta`,
          inline: true
        },
        {
          name: '🛡️ Xavfsizlik Darajasi',
          value: `${verificationLevels[guild.verificationLevel] || 'Noma\'lum'}`,
          inline: true
        }
      )
      .setFooter({ text: `So'rovchi: ${interaction.user.tag}` })
      .setTimestamp();

    if (guild.bannerURL()) {
      embed.setImage(guild.bannerURL({ dynamic: true, size: 2048 }));
    }

    await interaction.editReply({ embeds: [embed] });
  }
};
