const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const storage = require('../../config/storage');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('O\'zingizning yoki boshqa a\'zoning darajasi (Level va XP) ni ko\'rish')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('Darajasini ko\'rmoqchi bo\'lgan a\'zoni tanlang (Ixtiyoriy)')
        .setRequired(false)
    ),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const guild = interaction.guild;
    const stats = storage.getUserLevel(guild.id, targetUser.id);

    if (!stats.enabled) {
      const disabledEmbed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('ℹ️ Level & XP Tizimi O\'chirilgan')
        .setDescription(
          'Ushbu serverda chat faolligi uchun Level & XP tizimi hozirda faol emas.\n\n' +
          '👑 **Administratorlar:** `/set-level status:Yoqish` buyrug\'i orqali tizimni istalgan vaqt faollashtirishi mumkin.'
        )
        .setTimestamp();

      return interaction.reply({ embeds: [disabledEmbed] });
    }

    const percentage = Math.min(100, Math.floor((stats.xp / stats.requiredXP) * 100));
    const filledBlocks = Math.min(10, Math.max(0, Math.round(percentage / 10)));
    const emptyBlocks = 10 - filledBlocks;
    const progressBar = '█'.repeat(filledBlocks) + '░'.repeat(emptyBlocks);

    const rankEmbed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`🏆 ${targetUser.displayName || targetUser.username} — Faollik Profili`)
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 512 }))
      .addFields(
        {
          name: '⭐ Daraja (Level)',
          value: `**${stats.level}**`,
          inline: true
        },
        {
          name: '🥇 Serverdagi O\'rni',
          value: `**#${stats.rank}**`,
          inline: true
        },
        {
          name: '💬 Jami Xabarlar',
          value: `**${stats.messages}** ta`,
          inline: true
        },
        {
          name: '✨ Tajriba (XP)',
          value: `**${stats.xp}** / **${stats.requiredXP}** XP (${percentage}%)`,
          inline: false
        },
        {
          name: '📈 Keyingi Darajagacha Progress',
          value: `\`[${progressBar}]\` **${percentage}%**`,
          inline: false
        }
      )
      .setFooter({ text: 'Cleva • Har bir xabar uchun 15-25 XP beriladi' })
      .setTimestamp();

    return interaction.reply({ embeds: [rankEmbed] });
  }
};
