const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const storage = require('../../config/storage');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set-ticket')
    .setDescription('Yordam va murojaatlar (Ticket) tizimini sozlaydi va tugmali panelni joylashtiradi')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Tugmali ticket paneli joylashadigan asosiy kanal')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .addChannelOption(option =>
      option.setName('category')
        .setDescription('Yangi ochiladigan ticketlar qaysi kategoriya ichida ochilsin?')
        .addChannelTypes(ChannelType.GuildCategory)
        .setRequired(true)
    )
    .addRoleOption(option =>
      option.setName('support_role')
        .setDescription('Murojaatlarni ko\'ra oladigan moderator/support roli (ixtiyoriy)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('title')
        .setDescription('Panel sarlavhasi (ixtiyoriy)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('description')
        .setDescription('Panel matni (ixtiyoriy, yangi qator uchun \\n yozing)')
        .setRequired(false)
    ),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');
    const category = interaction.options.getChannel('category');
    const supportRole = interaction.options.getRole('support_role');
    const customTitle = interaction.options.getString('title');
    const customDesc = interaction.options.getString('description');
    const guild = interaction.guild;

    // Bot ruxsatlarini tekshirish
    const botMember = guild.members.me;
    if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return interaction.reply({
        content: '❌ Botda kanallarni boshqarish (**Manage Channels**) ruxsati yo\'q! Ticket tizimi ishlashi uchun botga ushbu ruxsatni bering.',
        ephemeral: true
      });
    }

    // Sozlamalarni saqlash
    storage.updateGuildSettings(guild.id, {
      ticketChannelId: channel.id,
      ticketCategoryId: category.id,
      supportRoleId: supportRole ? supportRole.id : null
    });

    const panelTitle = customTitle || '🎫 Rol Olish va Murojaat Markazi';
    const panelDescription = customDesc ? customDesc.replace(/\\n/g, '\n') : (
      'Serverda rol olish, savol berish yoki ma\'muriyat bilan bog\'lanish uchun pastdagi tugmani bosing!\n\n' +
      '🎭 **Rol olish:** Klan roli, maxsus rol yoki status olish uchun;\n' +
      '❓ **Yordam:** Serverdagi savollar yoki muammolar bo\'yicha;\n' +
      '💡 **Taklif va Shikoyatlar:** Fikr-mulohazalaringiz bo\'yicha.\n\n' +
      'Pastdagi **"Ticket Ochish"** tugmasini bosing. Faqat siz va ma\'muriyat ko\'ra oladigan shaxsiy kanal ochiladi.'
    );

    // Asosiy kanalda chiqadigan chiroyli panel
    const panelEmbed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(panelTitle)
      .setDescription(panelDescription)
      .setFooter({ text: `${guild.name} • Rol olish va yordam markazi` })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('ticket_create')
        .setLabel('🎫 Ticket Ochish (Rol / Yordam)')
        .setStyle(ButtonStyle.Primary)
    );

    try {
      await channel.send({ embeds: [panelEmbed], components: [row] });

      const successEmbed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('✅ Ticket Tizimi Muvaffaqiyatli Sozlandi')
        .addFields(
          { name: 'Asosiy Panel Kanali', value: `<#${channel.id}>`, inline: true },
          { name: 'Ticketlar Kategoriyasi', value: `**${category.name}**`, inline: true },
          { name: 'Support Roli', value: supportRole ? `${supportRole}` : 'Faqat Adminlar', inline: true }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [successEmbed], ephemeral: true });
    } catch (error) {
      console.error('Set-ticket xatosi:', error);
      await interaction.reply({
        content: `❌ Xatolik yuz berdi: ${error.message}`,
        ephemeral: true
      });
    }
  }
};
