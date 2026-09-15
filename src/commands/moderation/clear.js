const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Chatdagi xabarlarni tozalaydi (1 dan 100 tagacha)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false)
    .addIntegerOption(option =>
      option.setName('count')
        .setDescription('O\'chirilishi kerak bo\'lgan xabarlar soni (1 - 100)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    )
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Faqat ma\'lum bir foydalanuvchining xabarlarini o\'chirish (ixtiyoriy)')
        .setRequired(false)
    ),

  async execute(interaction) {
    const count = interaction.options.getInteger('count');
    const filterUser = interaction.options.getUser('user');
    const channel = interaction.channel;

    await interaction.deferReply({ ephemeral: true });

    try {
      let messages = await channel.messages.fetch({ limit: 100 });

      if (filterUser) {
        messages = messages.filter(m => m.author.id === filterUser.id);
      }

      // 14 kundan eski xabarlarni Discord bulkDelete qila olmaydi
      const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
      const validMessages = messages.filter(m => m.createdTimestamp > twoWeeksAgo);

      const toDelete = Array.from(validMessages.values()).slice(0, count);

      if (toDelete.length === 0) {
        return interaction.editReply({
          content: '❌ O\'chirish uchun yaroqli xabarlar topilmadi (Discord 14 kundan eski xabarlarni ommaviy o\'chira olmaydi).'
        });
      }

      const deleted = await channel.bulkDelete(toDelete, true);

      await interaction.editReply({
        content: `✅ Muvaffaqiyatli **${deleted.size}** ta xabar tozalandi${filterUser ? ` (${filterUser.tag} ga tegishli)` : ''}.`
      });

      // Log
      await logger.sendLog(
        interaction.guild,
        new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle('🧹 Chat Tozalandi (/clear)')
          .setDescription(`**Kanal:** <#${channel.id}>\n**O\'chirilgan:** ${deleted.size} ta xabar\n**Moderator:** ${interaction.user.tag} (<@${interaction.user.id}>)${filterUser ? `\n**Filtr:** Faqat ${filterUser.tag}` : ''}`)
          .setTimestamp()
      );
    } catch (error) {
      console.error('Clear xatosi:', error);
      await interaction.editReply({
        content: `❌ Xabarlarni o'chirishda xatolik: ${error.message}`
      });
    }
  }
};
