const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Foydalanuvchidan timeout (mute) jazo muddatini bekor qiladi')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false)
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Mute bekor qilinadigan foydalanuvchi')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Bekor qilish sababi')
        .setRequired(false)
    ),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'Sabab ko\'rsatilmadi';
    const guild = interaction.guild;

    const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
    if (!targetMember) {
      return interaction.reply({
        content: '❌ Bu foydalanuvchi serverda topilmadi.',
        ephemeral: true
      });
    }

    if (!targetMember.communicationDisabledUntilTimestamp || targetMember.communicationDisabledUntilTimestamp <= Date.now()) {
      return interaction.reply({
        content: `ℹ️ ${targetUser.tag} hozirda mute qilinmagan.`,
        ephemeral: true
      });
    }

    // Role hierarchy check
    if (!targetMember.moderatable) {
      return interaction.reply({
        content: '❌ Men bu foydalanuvchining mutesini bekor qila olmayman (roli yuqori).',
        ephemeral: true
      });
    }

    try {
      await targetMember.timeout(null, `${reason} | Ijrochi: ${interaction.user.tag}`);

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('🔊 Mute Bekor Qilindi')
        .setDescription(`${targetUser} (<@${targetUser.id}>) ning ovozi qayta tiklandi.`)
        .addFields(
          { name: 'Ijrochi', value: `${interaction.user.tag}`, inline: true },
          { name: 'Sabab', value: reason, inline: true }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

      await logger.logModAction(
        guild,
        'Unmute (Timeout bekor qilindi)',
        interaction.user,
        targetUser,
        reason
      );
    } catch (error) {
      console.error('Unmute xatosi:', error);
      return interaction.reply({
        content: `❌ Unmute qilishda xatolik: ${error.message}`,
        ephemeral: true
      });
    }
  }
};
