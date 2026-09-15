const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder, MessageFlags } = require('discord.js');
const storage = require('../../config/storage');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set-welcome')
    .setDescription('Yangi a\'zolar kirganda xush kelibsiz (welcome) xabarini sozlaydi')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Xush kelibsiz xabarlari yuboriladigan kanal')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('message')
        .setDescription('Xabar matni. O\'zgaruvchilar: {user}, {username}, {server}, {memberCount}')
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option.setName('status')
        .setDescription('Welcome tizimini yoqish (True) yoki o\'chirish (False)')
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option.setName('test')
        .setDescription('Hozirgi welcome xabarini sinov tariqasida shu yerda ko\'rsatish')
        .setRequired(false)
    ),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');
    const customMessage = interaction.options.getString('message');
    const status = interaction.options.getBoolean('status');
    const test = interaction.options.getBoolean('test');
    const guild = interaction.guild;

    const current = storage.getGuildSettings(guild.id);

    // Sinov (Preview) ko'rish
    if (test) {
      const template = customMessage || current.welcomeMessage || 'Xush kelibsiz, {user}! Siz serverimizning {memberCount}-a\'zosisiz 🎉';
      const rendered = template
        .replace(/{user}/g, `${interaction.user}`)
        .replace(/{username}/g, interaction.user.username)
        .replace(/{server}/g, guild.name)
        .replace(/{memberCount}/g, guild.memberCount);

      const previewEmbed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle(`🎉 Xush kelibsiz! (Sinov ko'rinishi)`)
        .setDescription(rendered)
        .setThumbnail(interaction.user.displayAvatarURL({ size: 512 }))
        .setFooter({ text: `${guild.name} • A'zolar: ${guild.memberCount}` })
        .setTimestamp();

      return interaction.reply({
        content: `🔍 **Welcome xabarining sinov ko'rinishi:**`,
        embeds: [previewEmbed],
        flags: MessageFlags.Ephemeral
      });
    }

    // Yangilanishlar obyektini to'plash
    const updates = {};
    if (channel) {
      updates.welcomeChannelId = channel.id;
      updates.welcomeEnabled = true; // Kanal belgilansa avtomatik yoqiladi
    }
    if (customMessage) {
      updates.welcomeMessage = customMessage;
    }
    if (status !== null) {
      updates.welcomeEnabled = status;
    }

    if (Object.keys(updates).length === 0) {
      // Hech narsa kiritilmagan bo'lsa, hozirgi holatni ko'rsatish
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('⚙️ Hozirgi Welcome Sozlamalari')
        .addFields(
          {
            name: 'Holat',
            value: current.welcomeEnabled ? '✅ Faol (Yoqilgan)' : '❌ O\'chirilgan',
            inline: true
          },
          {
            name: 'Kanal',
            value: current.welcomeChannelId ? `<#${current.welcomeChannelId}>` : 'Belgilanmagan',
            inline: true
          },
          {
            name: 'Hozirgi xabar matni',
            value: current.welcomeMessage || 'Standart matn',
            inline: false
          },
          {
            name: 'Mavjud o\'zgaruvchilar',
            value: '`{user}` — Foydalanuvchi belgisi (mention)\n`{username}` — Foydalanuvchi ismi\n`{server}` — Server nomi\n`{memberCount}` — Serverdagi a\'zolar soni',
            inline: false
          }
        );

      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    // Saqlash
    const saved = storage.updateGuildSettings(guild.id, updates);

    const resultEmbed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('✅ Welcome Sozlamalari Yangilandi')
      .addFields(
        {
          name: 'Holat',
          value: saved.welcomeEnabled ? '✅ Yoqilgan' : '❌ O\'chirilgan',
          inline: true
        },
        {
          name: 'Kanal',
          value: saved.welcomeChannelId ? `<#${saved.welcomeChannelId}>` : 'Belgilanmagan',
          inline: true
        },
        {
          name: 'Xabar shabloni',
          value: saved.welcomeMessage,
          inline: false
        }
      )
      .setFooter({ text: `Sozladi: ${interaction.user.tag}` })
      .setTimestamp();

    await interaction.reply({ embeds: [resultEmbed] });
  }
};
