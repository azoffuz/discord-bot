const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roles')
    .setDescription('Serverdagi barcha rollar ro\'yxatini va statistikalarini ko\'rsatadi')
    .setDMPermission(false),

  async execute(interaction) {
    const guild = interaction.guild;
    const roles = guild.roles.cache
      .filter(r => r.id !== guild.id) // @everyone ni chiqarib tashlaymiz
      .sort((a, b) => b.position - a.position);

    if (roles.size === 0) {
      return interaction.reply({
        content: 'Serverda hech qanday qo\'shimcha rollar mavjud emas.',
        ephemeral: true
      });
    }

    // Rollar ro'yxatini shakllantirish
    const roleList = [];
    roles.forEach(role => {
      roleList.push(`${role} (${role.members.size} ta a'zo)`);
    });

    // Agar ro'yxat juda uzun bo'lsa (Discord limiti 4000 belgi)
    let description = roleList.join('\n');
    let isTruncated = false;

    if (description.length > 3800) {
      // Qisqartirish
      description = '';
      for (const item of roleList) {
        if ((description + item + '\n').length > 3700) {
          isTruncated = true;
          break;
        }
        description += item + '\n';
      }
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`📜 Server Rollari — ${guild.name}`)
      .setDescription(description + (isTruncated ? `\n*...va yana boshqa rollar mavjud.*` : ''))
      .addFields(
        { name: 'Jami rollar soni', value: `${roles.size} ta`, inline: true },
        { name: 'Eng yuqori rol', value: `${roles.first()}`, inline: true }
      )
      .setFooter({ text: `So'rovchi: ${interaction.user.tag}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
