const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags
} = require('discord.js');
const storage = require('../../config/storage');
const log = require('../../utils/log');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set-verify')
    .setDescription('Serverga kirishda Kaptcha / Tekshiruv (Verification) tizimini sozlash')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)
    .addStringOption(option =>
      option
        .setName('status')
        .setDescription('Tekshiruv tizimini yoqish, o\'chirish yoki holatini ko\'rish')
        .setRequired(false)
        .addChoices(
          { name: '✅ Yoqish (Panelni chiqarish va tizimni ishga tushirish)', value: 'enable' },
          { name: '❌ O\'chirish (Tekshiruv tizimini to\'xtatish)', value: 'disable' },
          { name: 'ℹ️ Holat (Joriy sozlamalarni ko\'rish)', value: 'status' }
        )
    )
    .addRoleOption(option =>
      option
        .setName('role')
        .setDescription('Tekshiruvdan o\'tgan a\'zoga beriladigan rol (masalan: @A\'zo)')
        .setRequired(false)
    )
    .addChannelOption(option =>
      option
        .setName('channel')
        .setDescription('Tekshiruv paneli joylashadigan kanal (masalan: #tekshiruv)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('type')
        .setDescription('Tekshiruv usuli turi')
        .setRequired(false)
        .addChoices(
          { name: '🔘 Oddiy tugma (1 marta bosish bilan kirish — Tez va oson)', value: 'button' },
          { name: '🔢 4 xonali xavfsizlik kodi (Botlarga qarshi kuchli himoya)', value: 'code' },
          { name: '🧮 Matematik misol (Masalan: 7 + 5 = ?)', value: 'math' }
        )
    )
    .addStringOption(option =>
      option
        .setName('title')
        .setDescription('Panel sarlavhasi (ixtiyoriy)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('description')
        .setDescription('Panel matni va qoidalari (yangi qator uchun \\n yozing)')
        .setRequired(false)
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

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const guild = interaction.guild;
    const settings = storage.getGuildSettings(guild.id);
    const status = interaction.options.getString('status');
    const role = interaction.options.getRole('role');
    const channel = interaction.options.getChannel('channel');
    const type = interaction.options.getString('type') || 'button';
    const customTitle = interaction.options.getString('title');
    const customDesc = interaction.options.getString('description');

    // 1. HOLATNI KO'RISH (status tanlanganda yoki hech narsa kiritilmaganda)
    if (status === 'status' || (!status && !role && !channel)) {
      const v = settings.verification;
      if (!v || !v.enabled) {
        const infoEmbed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle('🛡️ Kaptcha va Tekshiruv Tizimi (Verification)')
          .setDescription(
            'Ushbu tizim serveringizni spamerlar va begona botlardan 100% himoya qiladi. Yangi a\'zolar tekshiruvdan o\'tmaguncha boshqa kanallarni ko\'ra olmaydi.\n\n' +
            '**Holati:** ❌ O\'chirilgan\n\n' +
            '**Tizimni sozlash:**\n' +
            '`/set-verify status:enable role:@Rol channel:#tekshiruv [type:button/code/math]`\n\n' +
            '**Mavjud tekshiruv usullari:**\n' +
            '• `button` — Bitta tugma bilan darhol kirish (Oddiy va qulay);\n' +
            '• `code` — 4 xonali tasodifiy xavfsizlik kodini kiritish;\n' +
            '• `math` — Oddiy arifmetik misolni yechish.'
          )
          .setFooter({ text: 'Cleva Security System' })
          .setTimestamp();
        return interaction.editReply({ embeds: [infoEmbed] });
      }

      const typeLabel = v.type === 'math' ? '🧮 Matematik misol' : v.type === 'code' ? '🔢 4 xonali kod' : '🔘 Oddiy tugma';
      const statusEmbed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('🛡️ Tekshiruv Tizimi Holati')
        .setDescription(
          `**Holati:** ✅ Faol va ishlamoqda\n` +
          `**Tekshiruv Kanali:** <#${v.channelId}>\n` +
          `**Beriladigan Rol:** <@&${v.roleId}>\n` +
          `**Tekshiruv Usuli:** ${typeLabel}\n` +
          (v.messageId ? `**Panel Xabari ID:** \`${v.messageId}\`\n\n` : '\n') +
          `💡 *Tizimni o'chirish uchun:* \`/set-verify status:disable\``
        )
        .setTimestamp();
      return interaction.editReply({ embeds: [statusEmbed] });
    }

    // 2. TIZIMNI O'CHIRISH (disable)
    if (status === 'disable') {
      if (!settings.verification || !settings.verification.enabled) {
        return interaction.editReply({
          content: 'ℹ️ Tekshiruv tizimi allaqachon o\'chirilgan holatda.'
        });
      }

      // Oldingi panel xabarini o'chirishga urinish
      if (settings.verification.channelId && settings.verification.messageId) {
        const oldChannel = guild.channels.cache.get(settings.verification.channelId) ||
          await guild.channels.fetch(settings.verification.channelId).catch(() => null);
        if (oldChannel) {
          const oldMsg = await oldChannel.messages.fetch(settings.verification.messageId).catch(() => null);
          if (oldMsg) await oldMsg.delete().catch(() => {});
        }
      }

      storage.updateGuildSettings(guild.id, {
        verification: {
          enabled: false,
          channelId: null,
          roleId: null,
          messageId: null,
          type: 'button'
        }
      });

      const disableEmbed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('🛡️ Tekshiruv Tizimi O\'chirildi')
        .setDescription('Serverda tekshiruv tizimi to\'liq o\'chirildi va paneli olib tashlandi.')
        .setTimestamp();

      return interaction.editReply({ embeds: [disableEmbed] });
    }

    // 3. TIZIMNI YOQISH (enable)
    if (!role) {
      return interaction.editReply({
        content: '❌ Tekshiruv tizimini yoqish uchun **role** parametrida a\'zolarga beriladigan rolni tanlashingiz shart (masalan: `/set-verify status:enable role:@A\'zo`).'
      });
    }

    const targetChannel = channel || interaction.channel;

    // Kanal turini tekshirish
    if (!targetChannel.isTextBased()) {
      return interaction.editReply({
        content: '❌ Tekshiruv paneli faqat oddiy matnli kanalda ochilishi mumkin.'
      });
    }

    // Botning roldan yuqoriligini tekshirish
    const me = guild.members.me || await guild.members.fetchMe().catch(() => null);
    if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return interaction.editReply({
        content: '❌ Botda rollarni boshqarish (`Manage Roles`) ruxsati yo\'q. Iltimos, botga ushbu ruxsatni bering.'
      });
    }

    if (role.id === guild.id || role.managed) {
      return interaction.editReply({
        content: '❌ Ushbu rolni (@everyone yoki integratsiya rollarini) tekshiruv roli sifatida berib bo\'lmaydi.'
      });
    }

    if (role.position >= me.roles.highest.position) {
      return interaction.editReply({
        content: `❌ Men bu rolni (${role.name}) bera olmayman, chunki u mening rolimdan yuqorida yoki teng joylashgan. Server Sozlamalarida (Roles bo'limida) bot rolimni ushbu roldan yuqoriroqqa surib qo'ying.`
      });
    }

    // Oldingi panel xabari bo'lsa tozalash
    if (settings.verification && settings.verification.messageId && settings.verification.channelId) {
      const prevChannel = guild.channels.cache.get(settings.verification.channelId) ||
        await guild.channels.fetch(settings.verification.channelId).catch(() => null);
      if (prevChannel) {
        const prevMsg = await prevChannel.messages.fetch(settings.verification.messageId).catch(() => null);
        if (prevMsg) await prevMsg.delete().catch(() => {});
      }
    }

    const panelTitle = customTitle || '🛡️ Server Tekshiruvi | Verification';
    const panelDesc = customDesc ? customDesc.replace(/\\n/g, '\n') : (
      `**Serverimizga xush kelibsiz!** 👋\n\n` +
      `Serverda to'liq xavfsizlikni ta'minlash va begona botlar/spamerlardan himoyalanish maqsadida tekshiruv tizimi yoqilgan.\n\n` +
      `📌 **Muhim eslatma:**\n` +
      `• Tekshiruvdan o'tishingiz bilan sizga <@&${role.id}> roli beriladi va serverdagi asosiy chatlar ochiladi;\n` +
      `• Iltimos, server qoidalariga va odob-axloq me'yorlariga rioya qiling.\n\n` +
      `Quyidagi **"✅ Serverga Kirish"** tugmasini bosing!`
    );

    const panelEmbed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle(panelTitle)
      .setDescription(panelDesc)
      .setThumbnail(guild.iconURL({ size: 512 }))
      .setFooter({ text: `${guild.name} • Xavfsizlik Tizimi` })
      .setTimestamp();

    const verifyBtn = new ButtonBuilder()
      .setCustomId('verify_start')
      .setLabel('✅ Serverga Kirish')
      .setStyle(ButtonStyle.Success);

    const row = new ActionRowBuilder().addComponents(verifyBtn);

    let panelMsg;
    try {
      panelMsg = await targetChannel.send({
        embeds: [panelEmbed],
        components: [row]
      });
    } catch (err) {
      log.error('[SET-VERIFY PANEL ERROR]:', err);
      return interaction.editReply({
        content: `❌ Belgilangan kanalga (<#${targetChannel.id}>) panel yuborishda xatolik: ${err.message}. Botda ushbu kanalda xabar yozish ruxsati borligini tekshiring.`
      });
    }

    storage.updateGuildSettings(guild.id, {
      verification: {
        enabled: true,
        channelId: targetChannel.id,
        roleId: role.id,
        messageId: panelMsg.id,
        type,
        title: panelTitle,
        description: panelDesc
      }
    });

    const typeName = type === 'math' ? '🧮 Matematik misol' : type === 'code' ? '🔢 4 xonali kod' : '🔘 Oddiy 1-bosishli tugma';

    const successEmbed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('🛡️ Tekshiruv Tizimi Muvaffaqiyatli Yoqildi!')
      .setDescription(
        `**Tekshiruv paneli muvaffaqiyatli joylashtirildi va tizim ishga tushdi!**\n\n` +
        `📁 **Kanal:** <#${targetChannel.id}>\n` +
        `👑 **Beriladigan Rol:** <@&${role.id}>\n` +
        `⚙️ **Tekshiruv Usuli:** ${typeName}\n\n` +
        `💡 **Tavsiya va Sozlash:**\n` +
        `Yangi a'zolar kirganda faqat ushbu <#${targetChannel.id}> kanalini ko'rishi uchun, boshqa asosiy kanallaringiz sozlamalarida **@everyone** rolidan *"Kanallarni Ko'rish"* (View Channels) ruxsatini o'chirib, uni faqat <@&${role.id}> roliga bering!`
      )
      .setFooter({ text: 'O\'chirish uchun: /set-verify status:disable' })
      .setTimestamp();

    return interaction.editReply({ embeds: [successEmbed] });
  }
};
