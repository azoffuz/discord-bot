const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const logger = require('../../utils/logger');

// Vaqt matnini millisekundga o'giruvchi yordamchi funksiya
function parseDuration(str) {
  const match = str.match(/^(\d+)([smhd])$/i);
  if (!match) return null;

  const num = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  switch (unit) {
    case 's': return num * 1000;
    case 'm': return num * 60 * 1000;
    case 'h': return num * 60 * 60 * 1000;
    case 'd': return num * 24 * 60 * 60 * 1000;
    default: return null;
  }
}

function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds} soniya`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} daqiqa`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} soat`;
  const days = Math.floor(hours / 24);
  return `${days} kun`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Foydalanuvchini vaqtinchalik ovozini o\'chiradi (Timeout)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false)
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Mute qilinadigan foydalanuvchi')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('duration')
        .setDescription('Vaqt (masalan: 10m, 1h, 1d, 7d). Maksimal 28 kun.')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Mute qilish sababi')
        .setRequired(false)
    ),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user');
    const durationInput = interaction.options.getString('duration');
    const reason = interaction.options.getString('reason') || 'Sabab ko\'rsatilmadi';
    const guild = interaction.guild;

    const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
    if (!targetMember) {
      return interaction.reply({
        content: '❌ Bu foydalanuvchi serverda topilmadi.',
        ephemeral: true
      });
    }

    if (targetMember.user.bot) {
      return interaction.reply({
        content: '❌ Botlarni mute qilib bo\'lmaydi.',
        ephemeral: true
      });
    }

    if (targetMember.id === interaction.user.id) {
      return interaction.reply({
        content: '❌ O\'zingizni mute qila olmaysiz.',
        ephemeral: true
      });
    }

    // Role hierarchy
    const botMember = guild.members.me;
    if (!targetMember.moderatable) {
      return interaction.reply({
        content: '❌ Men bu foydalanuvchini mute qila olmayman. Uning roli meniki bilan teng yoki yuqori.',
        ephemeral: true
      });
    }

    if (interaction.user.id !== guild.ownerId && targetMember.roles.highest.position >= interaction.member.roles.highest.position) {
      return interaction.reply({
        content: '❌ Siz ushbu foydalanuvchini mute qila olmaysiz, chunki uning roli siznikidan yuqori yoki teng.',
        ephemeral: true
      });
    }

    const durationMs = parseDuration(durationInput);
    const maxMs = 28 * 24 * 60 * 60 * 1000; // 28 kun
    if (!durationMs || durationMs < 5000 || durationMs > maxMs) {
      return interaction.reply({
        content: '❌ Noto\'g\'ri vaqt formati! Misollar: `60s` (60 soniya), `10m` (10 daqiqa), `2h` (2 soat), `7d` (7 kun). Maksimal 28 kun.',
        ephemeral: true
      });
    }

    try {
      await targetMember.timeout(durationMs, `${reason} | Ijrochi: ${interaction.user.tag}`);

      // Foydalanuvchiga DM yuborishga urinish
      await targetUser.send({
        content: `🔇 Siz **${guild.name}** serverida **${formatDuration(durationMs)}** ga mute qilindingiz.\n**Sabab:** ${reason}`
      }).catch(() => {});

      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('🔇 Foydalanuvchi Mute Qilindi')
        .setDescription(`${targetUser} (<@${targetUser.id}>) muvaffaqiyatli mute qilindi.`)
        .addFields(
          { name: 'Muddat', value: formatDuration(durationMs), inline: true },
          { name: 'Ijrochi', value: `${interaction.user.tag}`, inline: true },
          { name: 'Sabab', value: reason, inline: false }
        )
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

      // Log
      await logger.logModAction(
        guild,
        'Mute (Timeout)',
        interaction.user,
        targetUser,
        reason,
        `Muddat: ${formatDuration(durationMs)}`
      );
    } catch (error) {
      console.error('Mute xatoligi:', error);
      return interaction.reply({
        content: `❌ Mute qilishda xatolik yuz berdi: ${error.message}`,
        ephemeral: true
      });
    }
  }
};
