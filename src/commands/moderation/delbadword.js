const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const storage = require('../../config/storage');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('delbadword')
    .setDescription('Taqiqlangan haqoratli so\'zni ro\'yxatdan olib tashlaydi yoki butunlay tozalaydi')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false)
    .addStringOption(option =>
      option.setName('word')
        .setDescription('Ro\'yxatdan olib tashlanadigan so\'z')
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option.setName('clear_all')
        .setDescription('Barcha taqiqlangan so\'zlarni butunlay tozalash (True)')
        .setRequired(false)
    ),

  async execute(interaction) {
    const { guild, user } = interaction;
    const wordInput = interaction.options.getString('word');
    const clearAll = interaction.options.getBoolean('clear_all');

    if (!wordInput && !clearAll) {
      return interaction.reply({
        content: '❌ Iltimos, o\'chirish uchun so\'z kiriting (`word:[so\'z]`) yoki barchasini tozalash uchun `clear_all:True` ni tanlang!',
        ephemeral: true
      });
    }

    // 1. Barchasini tozalash
    if (clearAll) {
      storage.clearBadWords(guild.id);

      const clearEmbed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('🧹 Taqiqlangan So\'zlar Tozalandi')
        .setDescription('Serverdagi barcha taqiqlangan haqoratli so\'zlar ro\'yxatdan olib tashlandi.')
        .setFooter({ text: `Tozalovchi: ${user.tag}` })
        .setTimestamp();

      await interaction.reply({ embeds: [clearEmbed] });

      await logger.logModAction(
        guild,
        'Barcha Taqiqlangan So\'zlar Tozalandi (/delbadword)',
        user,
        { name: 'Barcha so\'zlar', id: user.id },
        'Ro\'yxat butunlay tozalandi'
      ).catch(() => {});
      return;
    }

    // 2. Yagona so'zni o'chirish
    const { removed, total } = storage.removeBadWord(guild.id, wordInput);

    if (!removed) {
      return interaction.reply({
        content: `❌ \`${wordInput}\` so'zi taqiqlangan so'zlar ro'yxatida topilmadi! Barcha ro'yxatni ko'rish: \`/badwords\``,
        ephemeral: true
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('🗑️ Taqiqlangan So\'z Olib Tashlandi')
      .setDescription(
        `\`${wordInput.toLowerCase()}\` so'zi taqiqlangan so'zlar ro'yxatidan muvaffaqiyatli olib tashlandi.\n\n` +
        `**Qolgan taqiqlangan so'zlar soni:** ${total.length} ta`
      )
      .setFooter({ text: `O'chiruvchi: ${user.tag}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });

    await logger.logModAction(
      guild,
      'Taqiqlangan So\'z Olib Tashlandi (/delbadword)',
      user,
      { name: wordInput, id: user.id },
      `O'chirilgan so'z: "${wordInput}" (Qolgan: ${total.length} ta)`
    ).catch(() => {});
  }
};
