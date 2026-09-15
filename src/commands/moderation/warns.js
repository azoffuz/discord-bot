const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const storage = require('../../config/storage');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warns')
    .setDescription('Foydalanuvchilarning ogohlantirishlarini (warnlarini) ko\'rish va boshqarish')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false)
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('Foydalanuvchining barcha ogohlantirishlari ro\'yxatini ko\'rish')
        .addUserOption(opt =>
          opt.setName('user')
            .setDescription('Tekshiriladigan foydalanuvchi')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Bitta aniq ogohlantirishni o\'chirish (Warn ID orqali)')
        .addUserOption(opt =>
          opt.setName('user')
            .setDescription('Foydalanuvchi')
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('warn_id')
            .setDescription('O\'chirilishi kerak bo\'lgan Warn ID si')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('clear')
        .setDescription('Foydalanuvchining barcha ogohlantirishlarini butunlay tozalash')
        .addUserOption(opt =>
          opt.setName('user')
            .setDescription('Foydalanuvchi')
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const targetUser = interaction.options.getUser('user');
    const guild = interaction.guild;

    // 1. LIST SUBCOMMAND
    if (subcommand === 'list') {
      const warns = storage.getUserWarns(guild.id, targetUser.id);

      if (warns.length === 0) {
        return interaction.reply({
          content: `✅ ${targetUser.tag} da hech qanday ogohlantirish mavjud emas (toza).`,
          flags: MessageFlags.Ephemeral
        });
      }

      const listText = warns.map((w, i) => {
        const timeStr = w.date ? `<t:${Math.floor(new Date(w.date).getTime() / 1000)}:d>` : 'Noma\'lum sana';
        return `**${i + 1}.** \`[ID: ${w.id}]\` — ${w.reason}\n   ↳ *Moderator: <@${w.moderatorId}> • Sana: ${timeStr}*`;
      }).join('\n\n');

      const embed = new EmbedBuilder()
        .setColor(0xFEE75C)
        .setTitle(`⚠️ ${targetUser.tag} ning Ogohlantirishlari (${warns.length} ta)`)
        .setThumbnail(targetUser.displayAvatarURL())
        .setDescription(listText.slice(0, 3900))
        .setFooter({ text: `Warnni o'chirish uchun: /warns remove user:@${targetUser.username} warn_id:[ID]` })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    // 2. REMOVE SUBCOMMAND
    if (subcommand === 'remove') {
      const warnId = interaction.options.getString('warn_id');
      const removed = storage.removeUserWarn(guild.id, targetUser.id, warnId);

      if (!removed) {
        return interaction.reply({
          content: `❌ ${targetUser.tag} da \`${warnId}\` ID li ogohlantirish topilmadi!`,
          flags: MessageFlags.Ephemeral
        });
      }

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('✅ Ogohlantirish Olib Tashlandi')
        .setDescription(`${targetUser} ning \`[ID: ${warnId}]\` ogohlantirishi muvaffaqiyatli o'chirildi.`)
        .addFields(
          { name: 'O\'chirilgan warn sababi', value: removed.reason || 'Sababsiz' },
          { name: 'Moderator', value: `${interaction.user.tag}` }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

      await logger.logModAction(
        guild,
        'Warn O\'chirildi',
        interaction.user,
        targetUser,
        `O'chirilgan Warn ID: ${warnId}`
      );
      return;
    }

    // 3. CLEAR SUBCOMMAND
    if (subcommand === 'clear') {
      const clearedCount = storage.clearUserWarns(guild.id, targetUser.id);

      if (clearedCount === 0) {
        return interaction.reply({
          content: `ℹ️ ${targetUser.tag} da tozalash uchun ogohlantirishlar mavjud emas.`,
          flags: MessageFlags.Ephemeral
        });
      }

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('🧹 Barcha Ogohlantirishlar Tozalandi')
        .setDescription(`${targetUser} ning barcha (**${clearedCount} ta**) ogohlantirishlari muvaffaqiyatli o'chirildi!`)
        .setFooter({ text: `Moderator: ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

      await logger.logModAction(
        guild,
        'Warnlar Tozalandi (Clear)',
        interaction.user,
        targetUser,
        `Jami o'chirilgan warnlar soni: ${clearedCount} ta`
      );
    }
  }
};
