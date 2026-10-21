const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const storage = require('../../config/storage');

const MODE_LABELS = {
  stack: '📚 Barcha rollar qoladi (Stack)',
  highest: '👑 Faqat eng yuqori rol qoladi (Highest)'
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set-level-rewards')
    .setDescription('Ma\'lum darajaga yetgan a\'zolarga avtomatik rol berish (Level mukofotlari)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)
    .addSubcommand(sub =>
      sub
        .setName('add')
        .setDescription('Darajaga rol mukofotini qo\'shish (yoki almashtirish)')
        .addIntegerOption(option =>
          option
            .setName('level')
            .setDescription('Qaysi darajada beriladi (masalan: 5)')
            .setMinValue(2)
            .setMaxValue(500)
            .setRequired(true)
        )
        .addRoleOption(option =>
          option
            .setName('role')
            .setDescription('Beriladigan rol')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('remove')
        .setDescription('Rol mukofotini o\'chirish (daraja yoki rol bo\'yicha)')
        .addIntegerOption(option =>
          option
            .setName('level')
            .setDescription('O\'chiriladigan mukofot darajasi')
            .setMinValue(2)
            .setMaxValue(500)
            .setRequired(false)
        )
        .addRoleOption(option =>
          option
            .setName('role')
            .setDescription('O\'chiriladigan mukofot roli')
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('mode')
        .setDescription('Yangi mukofot olinganda eski mukofot rollari qolsinmi?')
        .addStringOption(option =>
          option
            .setName('type')
            .setDescription('Rejimni tanlang')
            .setRequired(true)
            .addChoices(
              { name: MODE_LABELS.stack, value: 'stack' },
              { name: MODE_LABELS.highest, value: 'highest' }
            )
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('list')
        .setDescription('Barcha daraja mukofotlarini ko\'rish')
    ),

  async execute(interaction) {
    const isOwner = process.env.OWNER_ID && interaction.user.id === process.env.OWNER_ID.trim();
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator) &&
        !interaction.member.permissions.has(PermissionFlagsBits.ManageGuild) &&
        !isOwner) {
      return interaction.reply({
        content: '❌ Ushbu buyruqdan foydalanish uchun sizda `Administrator` yoki `Manage Server` ruxsati bo\'lishi kerak.',
        flags: MessageFlags.Ephemeral
      });
    }

    const guild = interaction.guild;
    const sub = interaction.options.getSubcommand();

    if (sub === 'add') {
      const level = interaction.options.getInteger('level');
      const role = guild.roles.cache.get(interaction.options.getRole('role').id);

      if (!role || role.id === guild.id || role.managed) {
        return interaction.reply({
          content: '❌ Bu rolni mukofot qilib bo\'lmaydi (`@everyone` yoki bot/integratsiya roli).',
          flags: MessageFlags.Ephemeral
        });
      }
      if (!role.editable) {
        const botRole = guild.members.me?.roles.highest;
        return interaction.reply({
          content: `❌ Bot **${role.name}** rolini bera olmaydi. Botning roli (**${botRole?.name ?? '?'}**) undan yuqorida bo'lishi va botda \`Manage Roles\` ruxsati bo'lishi kerak.`,
          flags: MessageFlags.Ephemeral
        });
      }

      storage.setLevelReward(guild.id, level, role.id);
      const { enabled } = storage.getGuildSettings(guild.id).leveling;

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('🎁 Daraja Mukofoti Qo\'shildi')
        .setDescription(
          `**${level}-daraja**ga yetgan a'zolarga ${role} roli beriladi.\n\n` +
          '💡 *Bu darajadan allaqachon o\'tgan a\'zolar rolni keyingi safar XP olganda (chatda yozganda) avtomatik oladi.*' +
          (enabled ? '' : '\n\n⚠️ Level & XP tizimi hozir o\'chirilgan: `/set-level status:Yoqish`')
        )
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'remove') {
      const level = interaction.options.getInteger('level');
      const role = interaction.options.getRole('role');
      if (level === null && !role) {
        return interaction.reply({
          content: '❌ `level` yoki `role` dan kamida bittasini kiriting.',
          flags: MessageFlags.Ephemeral
        });
      }

      const removed = storage.removeLevelReward(guild.id, { level, roleId: role?.id ?? null });
      if (!removed) {
        return interaction.reply({
          content: 'ℹ️ Bunday mukofot topilmadi. Ro\'yxat: `/set-level-rewards list`',
          flags: MessageFlags.Ephemeral
        });
      }

      return interaction.reply({
        content: `✅ **${removed.level}-daraja** mukofoti (<@&${removed.roleId}>) o'chirildi. A'zolarda bor rollar olib tashlanmaydi.`,
        allowedMentions: { parse: [] }
      });
    }

    if (sub === 'mode') {
      const mode = interaction.options.getString('type');
      storage.setLevelRewardMode(guild.id, mode);
      return interaction.reply({
        content: `✅ Mukofot rejimi: **${MODE_LABELS[mode]}**. A'zolar rollari keyingi XP olishda moslashtiriladi.`
      });
    }

    // list
    const { rewards, mode } = storage.getLevelRewards(guild.id);
    const embed = new EmbedBuilder()
      .setColor(0xFEE75C)
      .setTitle('🎁 Daraja Mukofotlari')
      .setDescription(
        rewards.length === 0
          ? 'Hozircha mukofotlar yo\'q. Qo\'shish: `/set-level-rewards add level:5 role:@Rol`'
          : rewards.map(r => `**${r.level}-daraja** → <@&${r.roleId}>`).join('\n')
      )
      .addFields({ name: '⚙️ Rejim', value: MODE_LABELS[mode], inline: false })
      .setTimestamp();

    return interaction.reply({ embeds: [embed], allowedMentions: { parse: [] } });
  }
};
