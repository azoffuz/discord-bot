const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const logger = require('../../utils/logger');
const log = require('../../utils/log');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('give-role')
    .setDescription('Foydalanuvchiga belgilangan rolni beradi')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .setDMPermission(false)
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Rol berilishi kerak bo\'lgan foydalanuvchi')
        .setRequired(true)
    )
    .addRoleOption(option =>
      option.setName('role')
        .setDescription('Beriladigan rol')
        .setRequired(true)
    ),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user');
    const targetRole = interaction.options.getRole('role');
    const guild = interaction.guild;

    const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
    if (!targetMember) {
      return interaction.reply({
        content: '❌ Bu foydalanuvchi serverda topilmadi.',
        flags: MessageFlags.Ephemeral
      });
    }

    // Botning rol ierarxiyasini tekshirish
    const botMember = guild.members.me;
    if (targetRole.position >= botMember.roles.highest.position) {
      return interaction.reply({
        content: `❌ Men bu rolni (${targetRole.name}) bera olmayman, chunki u mening rolimdan yuqori yoki teng darajada joylashgan. Bot rolimni Server Settings -> Roles da yuqoriroqqa surib qo'ying.`,
        flags: MessageFlags.Ephemeral
      });
    }

    // Buyruq bergan a'zoning rol ierarxiyasini tekshirish (agar server egasi bo'lmasa)
    if (interaction.user.id !== guild.ownerId && targetRole.position >= interaction.member.roles.highest.position) {
      return interaction.reply({
        content: `❌ Siz o'zingizning eng yuqori rolingizdan yuqori yoki unga teng rolni bera olmaysiz.`,
        flags: MessageFlags.Ephemeral
      });
    }

    if (targetMember.roles.cache.has(targetRole.id)) {
      return interaction.reply({
        content: `ℹ️ ${targetUser.tag} da allaqachon **${targetRole.name}** roli mavjud.`,
        flags: MessageFlags.Ephemeral
      });
    }

    try {
      await targetMember.roles.add(targetRole);

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('✅ Rol Muvaffaqiyatli Berildi')
        .setDescription(`${targetUser} (<@${targetUser.id}>) ga **${targetRole.name}** roli berildi!`)
        .addFields(
          { name: 'Ijrochi', value: `${interaction.user} (${interaction.user.tag})`, inline: true },
          { name: 'Rol', value: `${targetRole}`, inline: true }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

      // Log kanaliga yozish
      await logger.logModAction(
        guild,
        'Rol Berildi',
        interaction.user,
        targetUser,
        null,
        `Berilgan rol: <@&${targetRole.id}>`
      );
    } catch (error) {
      log.error('Give-role xatoligi:', error);
      return interaction.reply({
        content: `❌ Rol berishda xatolik yuz berdi: ${error.message}`,
        flags: MessageFlags.Ephemeral
      });
    }
  }
};
