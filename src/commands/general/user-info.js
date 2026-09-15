const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const storage = require('../../config/storage');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('user-info')
    .setDescription('Foydalanuvchi haqida to\'liq ma\'lumotlar va serverdagi faoliyati')
    .setDMPermission(false)
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Ma\'lumotlarini ko\'rmoqchi bo\'lgan foydalanuvchingiz')
        .setRequired(false)
    ),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const guild = interaction.guild;
    const member = await guild.members.fetch(targetUser.id).catch(() => null);

    const warns = storage.getUserWarns(guild.id, targetUser.id);

    const embed = new EmbedBuilder()
      .setColor(member?.displayColor || 0x5865F2)
      .setTitle(`👤 ${targetUser.tag} — Profil Ma'lumotlari`)
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 512 }))
      .addFields(
        {
          name: '🆔 ID',
          value: `\`${targetUser.id}\``,
          inline: true
        },
        {
          name: '🤖 Botmi?',
          value: targetUser.bot ? 'Ha' : 'Yo\'q',
          inline: true
        },
        {
          name: '⚠️ Ogohlantirishlar',
          value: `**${warns.length}** ta`,
          inline: true
        },
        {
          name: '📅 Discordga Ro\'yxatdan O\'tgan',
          value: `<t:${Math.floor(targetUser.createdTimestamp / 1000)}:f>\n(<t:${Math.floor(targetUser.createdTimestamp / 1000)}:R>)`,
          inline: true
        }
      )
      .setFooter({ text: `So'rovchi: ${interaction.user.tag}` })
      .setTimestamp();

    if (member) {
      embed.addFields(
        {
          name: '📥 Serverga Qo\'shilgan',
          value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:f>\n(<t:${Math.floor(member.joinedTimestamp / 1000)}:R>)`,
          inline: true
        },
        {
          name: `🎭 Rollar (${member.roles.cache.size - 1} ta)`,
          value: member.roles.cache
            .filter(r => r.id !== guild.id)
            .map(r => `${r}`)
            .slice(0, 15)
            .join(' ') || 'Roli yo\'q',
          inline: false
        }
      );
    }

    await interaction.reply({ embeds: [embed] });
  }
};
