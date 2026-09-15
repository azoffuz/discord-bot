const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder, MessageFlags } = require('discord.js');
const storage = require('../../config/storage');
const log = require('../../utils/log');

const REQUIRED_LOG_CHANNELS = [
  { key: 'messages', name: '🗑️・xabar-loglari', oldName: 'xabar-loglari', topic: '🗑️ Xabarlar o\'chirilishi va tahrirlanishi loglari' },
  { key: 'members', name: '👤・azo-loglari', oldName: 'azo-loglari', topic: '👤 Serverga a\'zolar kirishi, chiqishi va rollar o\'zgarishi loglari' },
  { key: 'moderation', name: '🛡️・moderatsiya-loglari', oldName: 'moderatsiya-loglari', topic: '🛡️ Mute, del-warn, lock, ban va anti-link loglari' },
  { key: 'tickets', name: '🎫・ticket-loglari', oldName: 'ticket-loglari', topic: '🎫 Ticket ochilishi, yopilishi va transcript fayllari loglari' },
  { key: 'voice', name: '🔊・ovozli-loglar', oldName: 'ovozli-loglar', topic: '🎙️ Ovozli kanallarga kirish, chiqish va ko\'chish loglari' }
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set-log')
    .setDescription('Log tizimini sozlaydi (o\'z serverida yoki boshqa serverda 5 ta log kanalini ochadi)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)
    .addChannelOption(option =>
      option.setName('category')
        .setDescription('Ushbu serverdagi log kanallari ochiladigan kategoriya')
        .addChannelTypes(ChannelType.GuildCategory)
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('external_category_id')
        .setDescription('Boshqa serverdagi kategoriya ID si (Bot o\'sha serverda 5 ta log kanalini ochadi)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('external_channel_id')
        .setDescription('Boshqa serverdagi bitta umumiy log kanali ID si')
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option.setName('disable')
        .setDescription('Log tizimini butunlay o\'chirib qo\'yish')
        .setRequired(false)
    ),

  async execute(interaction) {
    const category = interaction.options.getChannel('category');
    const externalCategoryId = interaction.options.getString('external_category_id');
    const externalChannelId = interaction.options.getString('external_channel_id');
    const disable = interaction.options.getBoolean('disable');
    const guild = interaction.guild;

    // 1. Tizimni o'chirish
    if (disable) {
      storage.updateGuildSettings(guild.id, {
        logCategoryId: null,
        logChannels: { messages: null, members: null, moderation: null, tickets: null, voice: null },
        logChannelId: null
      });
      return interaction.reply({
        content: '✅ Log tizimi ushbu serverda butunlay o\'chirib qo\'yildi.',
        flags: MessageFlags.Ephemeral
      });
    }

    // 2. Agar hech qanday parametr kiritilmagan bo'lsa, joriy holatni ko'rsatish
    if (!category && !externalCategoryId && !externalChannelId) {
      const current = storage.getGuildSettings(guild.id);
      const ch = current.logChannels || {};
      const hasAny = ch.messages || ch.moderation || current.logCategoryId || current.logChannelId;

      const embed = new EmbedBuilder()
        .setColor(hasAny ? 0x57F287 : 0xED4245)
        .setTitle('⚙️ Log Tizimi Sozlamalari')
        .setDescription(
          `**Tizim Holati:** ${hasAny ? '🟢 **Faol (Yoqilgan)**' : '🔴 **O\'chirilgan / Sozlanmagan**'}\n\n` +
          `• 🗑️ **Xabar loglari:** ${ch.messages ? `<#${ch.messages}>` : '*Yo\'q*'}\n` +
          `• 👤 **A'zo loglari:** ${ch.members ? `<#${ch.members}>` : '*Yo\'q*'}\n` +
          `• 🛡️ **Moderatsiya loglari:** ${ch.moderation ? `<#${ch.moderation}>` : '*Yo\'q*'}\n` +
          `• 🎫 **Ticket loglari:** ${ch.tickets ? `<#${ch.tickets}>` : '*Yo\'q*'}\n` +
          `• 🔊 **Ovozli loglar:** ${ch.voice ? `<#${ch.voice}>` : '*Yo\'q*'}\n`
        )
        .addFields(
          {
            name: '💡 Qanday sozlash mumkin?',
            value:
              '• **Shu serverda sozlash:** `/set-log category:[kategoriya]`\n' +
              '• **Boshqa serverga yo\'naltirish (5 ta kanal ochish):** `/set-log external_category_id:[Kategoriya ID]`\n' +
              '• **Boshqa serverdagi bitta kanalga jamlash:** `/set-log external_channel_id:[Kanal ID]`\n' +
              '• **O\'chirish:** `/set-log disable:True`'
          }
        )
        .setFooter({ text: 'Cleva • Cross-Server Logging' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    await interaction.deferReply();

    // 3. Boshqa serverdagi bitta umumiy kanalga yo'naltirish
    if (externalChannelId) {
      const cleanId = externalChannelId.trim();
      const targetChannel = await interaction.client.channels.fetch(cleanId).catch(() => null);

      if (!targetChannel || !targetChannel.isTextBased()) {
        return interaction.editReply({
          content: `❌ **Xatolik:** \`${cleanId}\` ID siga ega matnli kanal topilmadi! Bot ushbu serverga qo'shilganini va kanal ID si to'g'riligini tekshiring.`
        });
      }

      storage.updateGuildSettings(guild.id, {
        logCategoryId: null,
        logChannels: {
          messages: targetChannel.id,
          members: targetChannel.id,
          moderation: targetChannel.id,
          tickets: targetChannel.id,
          voice: targetChannel.id
        },
        logChannelId: targetChannel.id
      });

      const extEmbed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('✅ Loglar Boshqa Serverga Yo\'naltirildi!')
        .setDescription(
          `Ushbu serverdagi barcha hodisalar loglari endi boshqa serverga jo'natiladi:\n\n` +
          `• **Log Serveri:** **${targetChannel.guild?.name || 'Noma\'lum'}**\n` +
          `• **Kanal:** <#${targetChannel.id}> (\`${targetChannel.name}\`)\n\n` +
          `*Har bir log xabari ostida avtomatik ravishda \`🌐 Server: ${guild.name}\` belgisi ko'rsatiladi.*`
        )
        .setFooter({ text: `Sozlovchi: ${interaction.user.tag}` })
        .setTimestamp();

      return interaction.editReply({ embeds: [extEmbed] });
    }

    // 4. Kategoriya ichida 5 ta log kanalini ochish (O'z serverida yoki boshqa serverda)
    let targetCategory = category;
    let targetGuild = guild;

    if (externalCategoryId) {
      const cleanCatId = externalCategoryId.trim();
      const fetchedCat = await interaction.client.channels.fetch(cleanCatId).catch(() => null);

      if (!fetchedCat || fetchedCat.type !== ChannelType.GuildCategory) {
        return interaction.editReply({
          content: `❌ **Xatolik:** \`${cleanCatId}\` ID siga ega kategoriya topilmadi! Bot o'sha serverga qo'shilganini va to'g'ri Kategoriya ID sini kiritganingizni tekshiring.`
        });
      }

      targetCategory = fetchedCat;
      targetGuild = fetchedCat.guild;
    }

    // Botning ManageChannels ruxsatini tekshirish
    const botMember = targetGuild.members.me || await targetGuild.members.fetchMe().catch(() => null);
    if (!botMember || !botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return interaction.editReply({
        content: `❌ **Xatolik:** Botda **${targetGuild.name}** serverida kanallarni yaratish va boshqarish (**Manage Channels**) ruxsati yo'q! Iltimos, o'sha serverda bot roliga ushbu ruxsatni bering.`
      });
    }

    try {
      const createdChannels = {};
      const createdNames = [];

      for (const item of REQUIRED_LOG_CHANNELS) {
        // Kategoriya ichida shu nomli kanal bormi-yo'qligini tekshiramiz
        let channel = targetCategory.children.cache.find(c =>
          c.name === item.name || c.name === item.oldName || c.name.includes(item.key) || c.name.endsWith(item.oldName)
        );

        if (!channel) {
          channel = await targetGuild.channels.create({
            name: item.name,
            type: ChannelType.GuildText,
            parent: targetCategory.id,
            topic: `${item.topic} (Server: ${guild.name})`,
            permissionOverwrites: [
              {
                id: targetGuild.id, // @everyone ko'ra olmaydi
                deny: [PermissionFlagsBits.ViewChannel]
              },
              {
                id: botMember.id, // Bot ko'ra oladi va xabar yubora oladi
                allow: [
                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.SendMessages,
                  PermissionFlagsBits.EmbedLinks,
                  PermissionFlagsBits.AttachFiles
                ]
              }
            ]
          });

          // Yangi kanalga dastlabki xabarni yuborish
          const introEmbed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle(`📋 ${channel.name}`)
            .setDescription(`${item.topic}\n\n*Ushbu kanal faqat ma'muriyat uchun ko'rinadi.*`)
            .setFooter({ text: `Server: ${guild.name}` })
            .setTimestamp();

          await channel.send({ embeds: [introEmbed] }).catch(() => {});
        } else if (channel.name !== item.name) {
          await channel.setName(item.name).catch(() => {});
        }

        createdChannels[item.key] = channel.id;
        createdNames.push(`• **${item.topic.split(' ')[0]}** <#${channel.id}>`);
      }

      // Sozlamalarni joriy serverga saqlash
      storage.updateGuildSettings(guild.id, {
        logCategoryId: targetCategory.id,
        logChannels: createdChannels,
        logChannelId: createdChannels.moderation || createdChannels.messages
      });

      const isExternal = targetGuild.id !== guild.id;
      const responseEmbed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle(`✅ ${isExternal ? 'Boshqa Serverda' : ''} Log Tizimi Muvaffaqiyatli Sozlandi!`)
        .setDescription(
          (isExternal ? `🌐 **Log Serveri:** **${targetGuild.name}**\n` : '') +
          `📁 **Kategoriya:** **${targetCategory.name}**\n\n` +
          `Barcha 5 ta maxsus log kanallari muvaffaqiyatli ochildi va ulandi:\n\n${createdNames.join('\n')}\n\n` +
          `*${isExternal ? `Endi ${guild.name} serveridagi barcha loglar to'g'ridan-to'g'ri ushbu serverga kelib tushadi!` : 'Barcha server harakatlari qayd etiladi.'}*`
        )
        .setFooter({ text: `Sozlovchi: ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [responseEmbed] });
    } catch (error) {
      log.error('Set-log xatosi:', error);
      await interaction.editReply({
        content: `❌ Log kanallarini yaratishda xatolik yuz berdi: ${error.message}`
      });
    }
  }
};
