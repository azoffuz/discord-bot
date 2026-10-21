const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const storage = require('../../config/storage');
const logger = require('../../utils/logger');
const levelCurve = require('../../utils/levelCurve');
const { syncLevelRoles, getMemberFilter } = require('../../utils/levelManager');

const MAX_XP = 100_000_000;

const ACTION_LABELS = {
  give: 'XP berildi',
  remove: 'XP olib tashlandi',
  set: 'XP o\'rnatildi',
  reset: 'Daraja nolga tushirildi'
};

const addUser = sub => sub.addUserOption(option =>
  option.setName('user').setDescription('A\'zoni tanlang').setRequired(true));

const addReason = sub => sub.addStringOption(option =>
  option.setName('reason').setDescription('Sabab (mod logga yoziladi)').setMaxLength(500).setRequired(false));

const addAmount = sub => sub.addIntegerOption(option =>
  option.setName('amount').setDescription('XP miqdori').setMinValue(1).setMaxValue(MAX_XP).setRequired(true));

/** A'zo serverda bo'lsa, mukofot rollarini yangi darajaga moslaydi */
async function syncMemberRoles(guild, userId, level) {
  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) return;
  await syncLevelRoles(member, level, { removeAbove: true }).catch(err => {
    console.warn('XP buyrug\'i: rollarni moslashda xatolik:', err.message);
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('xp')
    .setDescription('A\'zolarning XP va darajasini boshqarish (Admin)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)
    .addSubcommand(sub => addReason(addAmount(addUser(
      sub.setName('give').setDescription('A\'zoga XP qo\'shish')))))
    .addSubcommand(sub => addReason(addAmount(addUser(
      sub.setName('remove').setDescription('A\'zodan XP ayirish')))))
    .addSubcommand(sub => addReason(addUser(
      sub.setName('set').setDescription('A\'zoning jami XP sini yoki darajasini o\'rnatish'))
      .addIntegerOption(option =>
        option.setName('xp').setDescription('Jami XP').setMinValue(0).setMaxValue(MAX_XP).setRequired(false))
      .addIntegerOption(option =>
        option.setName('level').setDescription('Daraja (shu darajaning boshiga o\'rnatiladi)').setMinValue(1).setMaxValue(500).setRequired(false))))
    .addSubcommand(sub => addReason(addUser(
      sub.setName('reset').setDescription('A\'zoning XP, xabar va ovoz hisobini nolga tushirish'))))
    .addSubcommand(sub => addReason(
      sub.setName('reset-all')
        .setDescription('⚠️ Serverdagi BARCHA a\'zolarning darajasini nolga tushirish')
        .addBooleanOption(option =>
          option.setName('confirm').setDescription('Tasdiqlash uchun True tanlang (qaytarib bo\'lmaydi!)').setRequired(true)))),

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
    const reason = interaction.options.getString('reason');

    if (sub === 'reset-all') {
      if (!interaction.options.getBoolean('confirm')) {
        return interaction.reply({
          content: 'ℹ️ Hech narsa o\'zgarmadi. Barcha darajalarni nolga tushirish uchun `confirm:True` tanlang.',
          flags: MessageFlags.Ephemeral
        });
      }

      await interaction.deferReply();
      const count = storage.resetAllLevels(guild.id);

      await logger.sendLog(guild, new EmbedBuilder()
        .setColor(0xEB459E)
        .setTitle('🛡️ Moderatsiya: Barcha darajalar nolga tushirildi')
        .setDescription(`**Moderator:** ${interaction.user.tag} (<@${interaction.user.id}>)\n**A'zolar soni:** ${count}`)
        .addFields(reason ? [{ name: 'Sabab', value: reason }] : [])
        .setTimestamp(), 'moderation').catch(() => {});

      // Mukofot rollarini olib tashlash (a'zolar ko'p bo'lsa vaqt oladi)
      const { rewards } = storage.getLevelRewards(guild.id);
      let rolesCleared = 0;
      if (rewards.length > 0) {
        await getMemberFilter(guild);
        const rewardIds = new Set(rewards.map(r => r.roleId));
        for (const member of guild.members.cache.values()) {
          if (member.user.bot || !member.roles.cache.some(role => rewardIds.has(role.id))) continue;
          await syncLevelRoles(member, levelCurve.MIN_LEVEL, { removeAbove: true }).catch(() => {});
          rolesCleared++;
        }
      }

      return interaction.editReply({
        content: `✅ **${count}** ta a'zoning darajasi, XP si va hisoblagichlari nolga tushirildi.` +
          (rewards.length > 0 ? `\n🎁 ${rolesCleared} ta a'zodan mukofot rollari olib tashlandi.` : '')
      });
    }

    const target = interaction.options.getUser('user');
    if (target.bot) {
      return interaction.reply({ content: '❌ Botlar XP to\'plamaydi.', flags: MessageFlags.Ephemeral });
    }

    const before = storage.getUserLevel(guild.id, target.id);
    let after;

    if (sub === 'give' || sub === 'remove') {
      after = storage.adjustXP(guild.id, target.id, sub, interaction.options.getInteger('amount'));
    } else if (sub === 'set') {
      const xp = interaction.options.getInteger('xp');
      const level = interaction.options.getInteger('level');
      if ((xp === null) === (level === null)) {
        return interaction.reply({
          content: '❌ `xp` yoki `level` dan **faqat bittasini** kiriting.',
          flags: MessageFlags.Ephemeral
        });
      }
      after = storage.adjustXP(guild.id, target.id, 'set', xp ?? levelCurve.totalXpForLevel(level));
    } else {
      // reset
      if (!storage.resetUserLevel(guild.id, target.id)) {
        return interaction.reply({
          content: `ℹ️ ${target} hali XP to'plamagan - nolga tushiradigan narsa yo'q.`,
          flags: MessageFlags.Ephemeral,
          allowedMentions: { parse: [] }
        });
      }
      after = { newLevel: levelCurve.MIN_LEVEL, totalXp: 0 };
    }

    await interaction.deferReply();
    await syncMemberRoles(guild, target.id, after.newLevel);

    const change =
      `✨ **XP:** ${before.totalXp} → **${after.totalXp}**\n` +
      `⭐ **Daraja:** ${before.level} → **${after.newLevel}**`;

    await logger.logModAction(guild, ACTION_LABELS[sub], interaction.user, target, reason, change).catch(() => {});

    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle(`✅ ${ACTION_LABELS[sub]}`)
      .setDescription(`👤 **A'zo:** ${target}\n${change}` + (reason ? `\n📝 **Sabab:** ${reason}` : ''))
      .setFooter({ text: 'Mukofot rollari yangi darajaga moslashtirildi • Cleva Leveling' })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed], allowedMentions: { parse: [] } });
  }
};
