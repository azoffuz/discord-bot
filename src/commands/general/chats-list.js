const { SlashCommandBuilder, EmbedBuilder, ChannelType, PermissionFlagsBits, MessageFlags } = require('discord.js');
const log = require('../../utils/log');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('chats-list')
    .setDescription('Serverdagi barcha kategoriyalar va chatlar (kanallar) ro\'yxatini chiqarish')
    .addBooleanOption(option =>
      option
        .setName('yashirin')
        .setDescription('Ro\'yxat faqat sizga ko\'rinishi kerakmi? (Ha/Yo\'q)')
        .setRequired(false)
    ),

  async execute(interaction) {
    const isHidden = interaction.options.getBoolean('yashirin') ?? false;
    if (isHidden) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    } else {
      await interaction.deferReply();
    }

    const guild = interaction.guild;

    try {
      // Barcha kanallarni tortib olish
      const channels = await guild.channels.fetch();

      const categories = channels
        .filter(c => c && c.type === ChannelType.GuildCategory)
        .sort((a, b) => a.position - b.position);

      const uncategorizedChannels = channels
        .filter(c => c && c.type !== ChannelType.GuildCategory && !c.parentId)
        .sort((a, b) => a.position - b.position);

      // Statistika
      const totalCategories = categories.size;
      const textChannels = channels.filter(c => c && (c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement)).size;
      const voiceChannels = channels.filter(c => c && (c.type === ChannelType.GuildVoice || c.type === ChannelType.GuildStageVoice)).size;
      const totalChannels = channels.filter(c => c && c.type !== ChannelType.GuildCategory).size;

      function getEmoji(type) {
        switch (type) {
          case ChannelType.GuildText: return '💬';
          case ChannelType.GuildVoice: return '🔊';
          case ChannelType.GuildAnnouncement: return '📢';
          case ChannelType.GuildStageVoice: return '🎭';
          case ChannelType.GuildForum: return '📋';
          default: return '📄';
        }
      }

      function formatChannel(c) {
        const emoji = getEmoji(c.type);
        const overwrites = c.permissionOverwrites?.cache?.get(guild.id);
        const isPrivate = overwrites && overwrites.deny.has(PermissionFlagsBits.ViewChannel);
        return `${emoji} <#${c.id}> ${isPrivate ? '🔒' : ''}`;
      }

      const embeds = [];
      let currentEmbed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`📑 ${guild.name} — Kategoriyalar va Kanallar Ro'yxati`)
        .setDescription(
          `📊 **Jami kanallar:** ${totalChannels} ta\n` +
          `• 📁 **Kategoriyalar:** ${totalCategories} ta\n` +
          `• 💬 **Matnli:** ${textChannels} ta\n` +
          `• 🔊 **Ovozli:** ${voiceChannels} ta\n` +
          `*(🔒 belgisi faqat maxsus ruxsatli/yopiq kanallarni bildiradi)*\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━`
        )
        .setThumbnail(guild.iconURL({ size: 256 }))
        .setFooter({ text: `Cleva • Jami ${totalChannels} ta kanal` })
        .setTimestamp();

      let fieldCount = 0;

      // 1. Kategoriyasiz kanallar (agar mavjud bo'lsa)
      if (uncategorizedChannels.size > 0) {
        const list = uncategorizedChannels.map(formatChannel).join('\n');
        currentEmbed.addFields({
          name: '📌 Kategoriyasiz Kanallar',
          value: list.length > 1024 ? list.slice(0, 1020) + '...' : list,
          inline: false
        });
        fieldCount++;
      }

      // 2. Har bir kategoriya bo'yicha kanallar
      for (const [catId, category] of categories) {
        const catChannels = channels
          .filter(c => c && c.parentId === catId)
          .sort((a, b) => a.position - b.position);

        let valueText = '*Bu kategoriyada kanal yo\'q*';
        if (catChannels.size > 0) {
          valueText = catChannels.map(formatChannel).join('\n');
          if (valueText.length > 1024) {
            valueText = valueText.slice(0, 1020) + '...';
          }
        }

        // Agar bitta embedda 25 ta field to'lsa, yangi embed ochamiz
        if (fieldCount >= 24) {
          embeds.push(currentEmbed);
          currentEmbed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle(`📑 ${guild.name} — Kanallar Ro'yxati (Davomi)`)
            .setFooter({ text: `Cleva • Jami ${totalChannels} ta kanal` })
            .setTimestamp();
          fieldCount = 0;
        }

        currentEmbed.addFields({
          name: `📁 ${category.name.toUpperCase()} (${catChannels.size})`,
          value: valueText,
          inline: false
        });
        fieldCount++;
      }

      embeds.push(currentEmbed);

      return interaction.editReply({ embeds: embeds.slice(0, 10) });
    } catch (err) {
      log.error('[CHATS-LIST XATOSI]:', err);
      return interaction.editReply({
        content: `❌ Kanallar ro'yxatini yuklashda xatolik yuz berdi: ${err.message}`
      });
    }
  }
};
