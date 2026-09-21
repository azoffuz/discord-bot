const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const storage = require('../../config/storage');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('addbadword')
    .setDescription('Serverga yangi taqiqlangan haqoratli so\'z qo\'shadi (chatda yozilsa o\'chiriladi va ogohlantiradi)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false)
    .addStringOption(option =>
      option.setName('word')
        .setDescription('Taqiqlanadigan so\'z yoki ibora (bir nechta bo\'lsa vergul bilan ajratib yozing)')
        .setRequired(true)
    ),

  async execute(interaction) {
    const { guild, user } = interaction;
    const wordInput = interaction.options.getString('word');

    if (!wordInput || !wordInput.trim()) {
      return interaction.reply({
        content: '❌ Iltimos, taqiqlanadigan so\'zni kiriting!',
        ephemeral: true
      });
    }

    // Vergul bilan bir nechta so'z kiritilgan bo'lsa ajratib olish
    const wordsToAdd = wordInput
      .split(',')
      .map(w => w.trim().toLowerCase())
      .filter(w => w.length > 0);

    if (wordsToAdd.length === 0) {
      return interaction.reply({
        content: '❌ Yaroqli so\'z kiritilmadi!',
        ephemeral: true
      });
    }

    const { added, total } = storage.addBadWords(guild.id, wordsToAdd);

    if (added.length === 0) {
      return interaction.reply({
        content: `ℹ️ Kiritilgan so'z(lar) allaqachon taqiqlangan so'zlar ro'yxatida mavjud.\n**Jami taqiqlangan so'zlar:** ${total.length} ta. Ro'yxatni ko'rish: \`/badwords\``,
        ephemeral: true
      });
    }

    const wordsDisplay = added.map(w => `\`${w}\``).join(', ');

    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('✅ Yangi Taqiqlangan So\'z Qo\'shildi')
      .setDescription(
        `Serverda quyidagi so'z(lar) muvaffaqiyatli taqiqlandi:\n• ${wordsDisplay}\n\n` +
        `🛡️ **AutoMod qoidasi:** Endi a'zolar ushbu so'zlarni chatda ishlatsa, bot xabarni **darhol o'chiradi** va:\n` +
        `> *"⚠️ @foydalanuvchi, iltimos, haqoratli so'z ishlatmang!"*\n` +
        `deb ogohlantirish beradi.`
      )
      .addFields(
        {
          name: '📊 Jami Taqiqlangan So\'zlar',
          value: `**${total.length} ta** so'z ro'yxatda mavjud.`,
          inline: true
        },
        {
          name: '💡 Boshqaruv Buyruqlari',
          value: '• Ro\'yxatni ko\'rish: `/badwords`\n• So\'zni o\'chirish: `/delbadword word:[so\'z]`',
          inline: false
        }
      )
      .setFooter({ text: `Qo'shuvchi: ${user.tag}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });

    await logger.logModAction(
      guild,
      'Taqiqlangan So\'z Qo\'shildi (/addbadword)',
      user,
      { name: wordsDisplay, id: user.id },
      `Qo'shilgan so'zlar: ${wordsDisplay} (Jami: ${total.length} ta)`
    ).catch(() => {});
  }
};
