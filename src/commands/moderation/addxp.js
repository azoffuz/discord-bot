const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const storage = require('../../config/storage');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('addxp')
    .setDescription('Foydalanuvchiga XP qo\'shadi va Leaderboard reytingini oshiradi (Admin)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('XP qo\'shiladigan a\'zoni tanlang')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName('amount')
        .setDescription('Qo\'shiladigan XP miqdori (masalan: 100, 500, 1000)')
        .setMinValue(1)
        .setMaxValue(1000000)
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('reason')
        .setDescription('XP berilish sababi (Ixtiyoriy)')
        .setRequired(false)
    ),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');
    const reason = interaction.options.getString('reason') || 'Administrator tomonidan mukofot';
    const guild = interaction.guild;

    // Botlarga XP berilmaydi
    if (targetUser.bot) {
      return interaction.reply({
        content: '❌ Botlarga XP va daraja berilmaydi.',
        ephemeral: true
      });
    }

    // XP qo'shish
    const result = storage.giveUserXP(guild.id, targetUser.id, amount);

    let levelText = `**${result.newLevel}-daraja**`;
    if (result.leveledUp) {
      levelText = `**${result.oldLevel} ➔ ${result.newLevel}-daraja** 🎉 *(Daraja ko'tarildi!)*`;
    }

    const percentage = Math.min(100, Math.floor((result.currentXP / result.requiredXP) * 100));
    const filledBlocks = Math.min(10, Math.max(0, Math.round(percentage / 10)));
    const emptyBlocks = 10 - filledBlocks;
    const progressBar = '█'.repeat(filledBlocks) + '░'.repeat(emptyBlocks);

    const embed = new EmbedBuilder()
      .setColor(result.leveledUp ? 0xFEE75C : 0x57F287)
      .setTitle(`✨ ${targetUser.displayName || targetUser.username} ga XP Qo'shildi!`)
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
      .addFields(
        {
          name: '👤 Foydalanuvchi',
          value: `<@${targetUser.id}>`,
          inline: true
        },
        {
          name: '➕ Qo\'shilgan XP',
          value: `**+${amount.toLocaleString()} XP**`,
          inline: true
        },
        {
          name: '⭐ Daraja (Level)',
          value: levelText,
          inline: false
        },
        {
          name: '📈 Joriy Progress',
          value: `**${result.currentXP}** / **${result.requiredXP}** XP (${percentage}%)\n\`[${progressBar}]\``,
          inline: false
        },
        {
          name: '🏆 Serverdagi O\'rni',
          value: `**#${result.rank}** (Leaderboard)`,
          inline: true
        },
        {
          name: '👮 Moderator / Admin',
          value: `<@${interaction.user.id}>`,
          inline: true
        },
        {
          name: '📝 Sabab',
          value: reason,
          inline: false
        }
      )
      .setFooter({ text: 'Cleva Leaderboard System • /rank orqali tekshirishingiz mumkin' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });

    // Agar daraja ko'tarilgan bo'lsa va maxsus level-up kanali sozlangan bo'lsa, xabar chiqarish
    if (result.leveledUp) {
      const settings = storage.getGuildSettings(guild.id);
      const notifyChannelId = settings.leveling?.channelId;
      if (notifyChannelId && notifyChannelId !== interaction.channelId) {
        const notifyChannel = guild.channels.cache.get(notifyChannelId) || await guild.channels.fetch(notifyChannelId).catch(() => null);
        if (notifyChannel && notifyChannel.isTextBased()) {
          const levelUpEmbed = new EmbedBuilder()
            .setColor(0xFEE75C)
            .setTitle('🎉 Yangi Daraja Erishildi!')
            .setDescription(`Tabriklaymiz <@${targetUser.id}>! Sizga qo'shilgan XP hisobiga **${result.newLevel}-darajaga** ko'tarildingiz! 🚀`)
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
            .setTimestamp();

          notifyChannel.send({ embeds: [levelUpEmbed] }).catch(() => {});
        }
      }
    }
  }
};
