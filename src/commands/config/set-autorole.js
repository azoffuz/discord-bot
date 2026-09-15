const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const storage = require('../../config/storage');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set-autorole')
    .setDescription('Yangi kirgan har bir a\'zoga avtomatik beriladigan rolni sozlaydi')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .setDMPermission(false)
    .addRoleOption(option =>
      option.setName('role')
        .setDescription('Avtomatik berilishi kerak bo\'lgan rol')
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option.setName('disable')
        .setDescription('Auto-role tizimini o\'chirish')
        .setRequired(false)
    ),

  async execute(interaction) {
    const role = interaction.options.getRole('role');
    const disable = interaction.options.getBoolean('disable');
    const guild = interaction.guild;

    if (disable) {
      storage.updateGuildSettings(guild.id, { autoRoleId: null });
      return interaction.reply({
        content: '✅ Auto-role tizimi o\'chirildi.',
        flags: MessageFlags.Ephemeral
      });
    }

    if (!role) {
      const current = storage.getGuildSettings(guild.id);
      return interaction.reply({
        content: current.autoRoleId
          ? `ℹ️ Hozirgi auto-role: <@&${current.autoRoleId}>.\nO'zgartirish uchun: \`/set-autorole role:@Rol\` deb yozing.`
          : 'ℹ️ Serverda auto-role belgilanmagan.\nBelgilash uchun: \`/set-autorole role:@Rol\` deb yozing.',
        flags: MessageFlags.Ephemeral
      });
    }

    // Botning ierarxiyasini tekshirish
    const botMember = guild.members.me;
    if (role.position >= botMember.roles.highest.position) {
      return interaction.reply({
        content: `❌ Men bu rolni (${role.name}) avtomatik bera olmayman, chunki u mening eng yuqori rolimdan yuqori yoki teng. Bot rolimni Server sozlamalarida yuqoriroqqa surib qo'ying.`,
        flags: MessageFlags.Ephemeral
      });
    }

    storage.updateGuildSettings(guild.id, { autoRoleId: role.id });

    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('✅ Auto-Role Muvaffaqiyatli O\'rnatildi')
      .setDescription(`Endi serverga yangi qo'shilgan har bir a'zoga avtomatik tarzda ${role} roli biriktiriladi!`)
      .setFooter({ text: `Sozlovchi: ${interaction.user.tag}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
