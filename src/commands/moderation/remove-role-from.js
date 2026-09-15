const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remove-role-from')
    .setDescription('1-tanlangan rolni 2-tanlangan roli bor barcha foydalanuvchilardan olib tashlaydi')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .setDMPermission(false)
    .addRoleOption(option =>
      option.setName('remove_role')
        .setDescription('Olib tashlanishi kerak bo\'lgan rol (1-rol)')
        .setRequired(true)
    )
    .addRoleOption(option =>
      option.setName('having_role')
        .setDescription('Ushbu roli bor odamlardan olib tashlanadi (2-rol)')
        .setRequired(true)
    ),

  async execute(interaction) {
    const roleToRemove = interaction.options.getRole('remove_role');
    const havingRole = interaction.options.getRole('having_role');
    const guild = interaction.guild;

    // Botning rol darajasini tekshirish
    const botMember = guild.members.me;
    if (roleToRemove.position >= botMember.roles.highest.position) {
      return interaction.reply({
        content: `❌ Men **${roleToRemove.name}** rolini olib tashlay olmayman, chunki mening rolim ushbu roldan pastda joylashgan.`,
        ephemeral: true
      });
    }

    // Buyruq beruvchining rol darajasini tekshirish
    if (interaction.user.id !== guild.ownerId && roleToRemove.position >= interaction.member.roles.highest.position) {
      return interaction.reply({
        content: `❌ Siz o'zingizning eng yuqori rolingizdan yuqori yoki unga teng rolni olib tashlay olmaysiz.`,
        ephemeral: true
      });
    }

    // Jarayon vaqt olishi mumkinligi sababli deferReply qilamiz
    await interaction.deferReply();

    try {
      // Serverdagi barcha a'zolarni yuklab olamiz
      const members = await guild.members.fetch();

      // havingRole ga ega bo'lgan a'zolarni filtrlaymiz
      const targetMembers = members.filter(
        m => m.roles.cache.has(havingRole.id) && m.roles.cache.has(roleToRemove.id)
      );

      if (targetMembers.size === 0) {
        return interaction.editReply({
          content: `ℹ️ **${havingRole.name}** roliga ega a'zolar ichida **${roleToRemove.name}** roliga ega hech kim topilmadi.`
        });
      }

      let removedCount = 0;
      let failedCount = 0;

      for (const [id, member] of targetMembers) {
        try {
          await member.roles.remove(roleToRemove, `Buyruq ijrochisi: ${interaction.user.tag}`);
          removedCount++;
        } catch (err) {
          failedCount++;
        }
      }

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('✅ Rol Ommaviy Olib Tashlandi')
        .setDescription(`Jarayon muvaffaqiyatli yakunlandi!`)
        .addFields(
          { name: 'Olib tashlangan rol', value: `${roleToRemove}`, inline: true },
          { name: 'Belgilangan a\'zolar guruhi', value: `${havingRole}`, inline: true },
          { name: 'Natija', value: `Muvaffaqiyatli: **${removedCount}** ta\nXatolik/Ruxsat yetmagan: **${failedCount}** ta`, inline: false }
        )
        .setFooter({ text: `Ijrochi: ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      // Log
      await logger.logModAction(
        guild,
        'Ommaviy Rol Olib Tashlandi',
        interaction.user,
        { tag: `${havingRole.name} egalari`, id: havingRole.id },
        `Olib tashlangan rol: ${roleToRemove.name}`,
        `Muvaffaqiyatli: ${removedCount} ta a'zodan olindi`
      );
    } catch (error) {
      console.error('Remove-role-from xatoligi:', error);
      await interaction.editReply({
        content: `❌ Jarayon davomida xatolik yuz berdi: ${error.message}`
      });
    }
  }
};
