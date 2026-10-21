const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const storage = require('../../config/storage');
const { MESSAGE_XP, VOICE_XP } = require('../../utils/levelCurve');
const { getMemberFilter } = require('../../utils/levelManager');

function formatVoice(minutes) {
  const h = Math.floor(minutes / 60);
  return h > 0 ? `${h} soat ${minutes % 60} daq` : `${minutes} daq`;
}

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

    if (!storage.getGuildSettings(guild.id).leveling.enabled) {
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

    // O'rin serverda qolgan a'zolar orasida hisoblanadi (a'zolarni yuklash vaqt olishi mumkin)
    await interaction.deferReply();
    const isMember = await getMemberFilter(guild);
    const stats = storage.getUserLevel(guild.id, targetUser.id, { isMember });

    const percentage = Math.min(100, Math.floor((stats.xp / stats.requiredXP) * 100));
    const filledBlocks = Math.min(10, Math.max(0, Math.round(percentage / 10)));
    const emptyBlocks = 10 - filledBlocks;
    const progressBar = '█'.repeat(filledBlocks) + '░'.repeat(emptyBlocks);

    const nextReward = storage.getLevelRewards(guild.id).rewards.find(r => r.level > stats.level);

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
          value: stats.rank ? `**#${stats.rank}**` : '*Reytingsiz*',
          inline: true
        },
        {
          name: '💬 Jami Xabarlar',
          value: `**${stats.messages}** ta`,
          inline: true
        },
        {
          name: '🎙️ Ovozda',
          value: `**${formatVoice(stats.voiceMinutes)}**`,
          inline: true
        },
        {
          name: '✨ Tajriba (XP)',
          value: `**${stats.xp}** / **${stats.requiredXP}** XP • Jami: **${stats.totalXp}** XP`,
          inline: false
        },
        {
          name: '📈 Keyingi Darajagacha Progress',
          value: `\`[${progressBar}]\` **${percentage}%** • Qoldi: **${stats.remainingXP}** XP`,
          inline: false
        }
      );

    if (nextReward) {
      rankEmbed.addFields({
        name: '🎁 Keyingi Mukofot',
        value: `<@&${nextReward.roleId}> — **${nextReward.level}-daraja**`,
        inline: false
      });
    }

    rankEmbed
      .setFooter({ text: `Cleva • Chat: daqiqada bir marta ${MESSAGE_XP.min}-${MESSAGE_XP.max} XP • Ovoz: daqiqasiga ${VOICE_XP.perMinute} XP` })
      .setTimestamp();

    return interaction.editReply({ embeds: [rankEmbed] });
  }
};
