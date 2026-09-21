const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const storage = require('../../config/storage');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('badwords')
    .setDescription('Serverdagi taqiqlangan haqoratli so\'zlar ro\'yxati va AutoMod holatini ko\'rsatadi')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false)
    .addBooleanOption(option =>
      option.setName('status')
        .setDescription('Filtr holatini yoqish yoki o\'chirish (True = Yoqish, False = O\'chirish)')
        .setRequired(false)
    ),

  async execute(interaction) {
    const { guild, user } = interaction;
    const statusOpt = interaction.options.getBoolean('status');

    if (statusOpt !== null) {
      storage.setBadWordsEnabled(guild.id, statusOpt);
    }

    const settings = storage.getGuildSettings(guild.id);
    const words = Array.isArray(settings.badWords) ? settings.badWords : [];
    const isEnabled = settings.badWordsEnabled !== false;

    let wordsText = '*Hozircha hech qanday taqiqlangan so\'z qo\'shilmagan.*';
    if (words.length > 0) {
      // Spoiler bilan chiqarish (ko'rinish odobli bo'lishi uchun)
      wordsText = words.map(w => `||\`${w}\`||`).join(', ');
      if (wordsText.length > 3800) {
        wordsText = wordsText.slice(0, 3800) + '...\n*(Ro\'yxat juda uzun)*';
      }
    }

    const embed = new EmbedBuilder()
      .setColor(isEnabled ? 0x5865F2 : 0xED4245)
      .setTitle('🤬 Taqiqlangan Haqoratli So\'zlar Ro\'yxati (AutoMod)')
      .setDescription(
        `**Filtr Holati:** ${isEnabled ? '🟢 **Faol (Yoqilgan)**' : '🔴 **O\'chirilgan (Nofaol)**'}\n` +
        `**Jami Taqiqlangan So'zlar:** **${words.length} ta**\n\n` +
        `**Ro'yxat:**\n${wordsText}\n\n` +
        `*Eslatma: So'zlar spoiler (||...||) qilingan, ustiga bosib ko'rishingiz mumkin.*`
      )
      .addFields({
        name: '💡 Qanday boshqarish mumkin?',
        value:
          '• **Yangi so\'z qo\'shish:** `/addbadword word:[so\'z]`\n' +
          '• **So\'zni o\'chirish:** `/delbadword word:[so\'z]`\n' +
          '• **Barchasini tozalash:** `/delbadword clear_all:True`\n' +
          '• **Filtrni yoqish/o\'chirish:** `/badwords status:True` yoki `status:False`'
      })
      .setFooter({ text: `Tekshiruvchi: ${user.tag}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
