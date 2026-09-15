const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  UserSelectMenuBuilder,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
  MessageFlags
} = require('discord.js');
const storage = require('../config/storage');
const log = require('./log');

// Xona egalari va faol xonalar xotirasi
const tempChannelOwners = new Map(); // channelId -> ownerId
const activeTempChannels = new Set();

/**
 * Yangi ochilgan ovozli xonaga boshqaruv panelini yuborish
 */
async function sendRoomControlPanel(channel, member) {
  try {
    tempChannelOwners.set(channel.id, member.id);
    activeTempChannels.add(channel.id);

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('🎙️ Shaxsiy Ovozli Xona Boshqaruv Paneli')
      .setDescription(
        `Assalomu alaykum, ${member}! Bu sizning shaxsiy ovozli xonangiz.\n\n` +
        '**Quyidagi tugmalar orqali xonani to\'liq boshqarishingiz mumkin:**\n\n' +
        '• 🔒 **Qulflash / Ochish** — Begona a\'zolar kirishini yopish (private) yoki ochish\n' +
        '• ➕ **Do\'stlarni Taklif Qilish** — Xona qulflangan bo\'lsa ham 2-5 ta do\'stingizga kirish ruxsatini berish\n' +
        '• 👥 **Chegara (Limit)** — Xonaga maksimum necha kishi kira olishini belgilash\n' +
        '• ✏️ **Nom O\'zgartirish** — Xona nomini xohlaganingizcha yangilash\n' +
        '• ⛔ **Chiqarib Yuborish** — Xonadan istalmagan a\'zoni chiqarish va qayta kirishini taqiqlash\n' +
        '• ❌ **Xonani Yopish** — Xonani yopish va qolgan barcha a\'zolarni asosiy chatga ko\'chirish'
      )
      .setFooter({ text: `Xona egasi: ${member.displayName || member.user.username}` })
      .setTimestamp();

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('vc_toggle_lock')
        .setLabel('Qulflash / Ochish')
        .setEmoji('🔒')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('vc_invite')
        .setLabel('Do\'stlarni Taklif Qilish')
        .setEmoji('➕')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('vc_limit')
        .setLabel('Chegara (Limit)')
        .setEmoji('👥')
        .setStyle(ButtonStyle.Secondary)
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('vc_rename')
        .setLabel('Nom O\'zgartirish')
        .setEmoji('✏️')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('vc_kick')
        .setLabel('Chiqarib Yuborish')
        .setEmoji('⛔')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('vc_close_room')
        .setLabel('Xonani Yopish')
        .setEmoji('❌')
        .setStyle(ButtonStyle.Danger)
    );

    await channel.send({
      content: `👋 Xush kelibsiz ${member}!`,
      embeds: [embed],
      components: [row1, row2]
    }).catch(err => {
      log.error('VC Panel yuborishda xatolik:', err.message);
    });
  } catch (err) {
    log.error('sendRoomControlPanel xatosi:', err);
  }
}

/**
 * Xona egasini aniqlash
 */
function getRoomOwner(channel) {
  if (!channel) return null;
  if (tempChannelOwners.has(channel.id)) {
    return tempChannelOwners.get(channel.id);
  }
  // Agar xotiradan o'chgan bo'lsa, kanal ruxsatlaridan xona egasini topish
  const ownerOverwrite = channel.permissionOverwrites?.cache?.find(o =>
    o.type === 1 && o.allow.has(PermissionFlagsBits.ManageChannels)
  );
  return ownerOverwrite ? ownerOverwrite.id : null;
}

/**
 * Barcha tugma, menyu va modallarni qayta ishlash
 */
async function handleTempVoiceInteraction(interaction) {
  const { customId, channel, user, guild } = interaction;
  if (!customId || !customId.startsWith('vc_')) return false;

  const ownerId = getRoomOwner(channel);
  const isOwner = user.id === ownerId;
  const isStaff = interaction.member?.permissions?.has(PermissionFlagsBits.Administrator);

  // Xona egasi bo'lmasa, rad etish
  if (!isOwner && !isStaff) {
    await interaction.reply({
      content: '❌ Bu xona sizga tegishli emas! Faqat xona egasi ushbu tugmalardan foydalana oladi.',
      flags: MessageFlags.Ephemeral
    }).catch(() => {});
    return true;
  }

  // 1. QULFLASH / OCHISH (LOCK / UNLOCK)
  if (customId === 'vc_toggle_lock') {
    const everyoneOverwrite = channel.permissionOverwrites.cache.get(guild.id);
    const isLocked = everyoneOverwrite && everyoneOverwrite.deny.has(PermissionFlagsBits.Connect);

    if (isLocked) {
      // Ochish (Unlock)
      await channel.permissionOverwrites.edit(guild.id, {
        Connect: null
      });
      await interaction.reply({
        content: '🔓 **Xonangiz ochildi (Public)!** Endi barcha a\'zolar bemalol kirishi mumkin.',
        flags: MessageFlags.Ephemeral
      });
    } else {
      // Qulflash (Lock / Private)
      await channel.permissionOverwrites.edit(guild.id, {
        Connect: false
      });
      // Xona egasiga ruxsat kafolatlanadi
      await channel.permissionOverwrites.edit(user.id, {
        Connect: true,
        ViewChannel: true,
        Speak: true
      });
      await interaction.reply({
        content: '🔒 **Xonangiz qulflandi (Private)!** Endi faqat siz va siz taklif qilgan do\'stlaringiz kira oladi.',
        flags: MessageFlags.Ephemeral
      });
    }
    return true;
  }

  // 2. DO'STLARNI TAKLIF QILISH (INVITE USER)
  if (customId === 'vc_invite') {
    const userSelect = new UserSelectMenuBuilder()
      .setCustomId('vc_select_invite')
      .setPlaceholder('Xonaga ruxsat bermoqchi bo\'lgan 1-5 ta do\'stingizni tanlang...')
      .setMinValues(1)
      .setMaxValues(5);

    await interaction.reply({
      content: '👥 **Do\'stlaringizni tanlang:**\nUlar xona qulflangan bo\'lsa ham bemalol kira olishadi.',
      components: [new ActionRowBuilder().addComponents(userSelect)],
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  if (customId === 'vc_select_invite' && interaction.isUserSelectMenu()) {
    const userIds = interaction.values;
    for (const uid of userIds) {
      await channel.permissionOverwrites.edit(uid, {
        Connect: true,
        ViewChannel: true,
        Speak: true
      });
    }

    const mentions = userIds.map(uid => `<@${uid}>`).join(', ');
    await interaction.update({
      content: `✅ **Do'stlaringizga xonaga kirish ruxsati berildi:** ${mentions}\n*Xona qulf bo'lsa ham, ular bemalol qo'shila oladi!*`,
      components: []
    });

    // Chatga rasmiy taklifnoma yuborish
    await channel.send({
      content: `👋 ${interaction.user} quyidagi do'stlarini ushbu xonaga taklif qildi: ${mentions} 🚀`
    }).catch(() => {});
    return true;
  }

  // 3. ODAMLAR SONI CHEGARASI (SET LIMIT)
  if (customId === 'vc_limit') {
    const limitMenu = new StringSelectMenuBuilder()
      .setCustomId('vc_select_limit')
      .setPlaceholder('Xonaga ko\'pi bilan necha kishi kira olsin?')
      .addOptions(
        { label: 'Cheksiz (Cheklovsiz)', value: '0', emoji: '♾️' },
        { label: '1 kishi (Yakka o\'zi)', value: '1', emoji: '👤' },
        { label: '2 kishi (Duet)', value: '2', emoji: '👥' },
        { label: '3 kishi (Trio)', value: '3', emoji: '👥' },
        { label: '4 kishi (Squad)', value: '4', emoji: '🎮' },
        { label: '5 kishi', value: '5', emoji: '🖐️' },
        { label: '10 kishi', value: '10', emoji: '🔟' }
      );

    await interaction.reply({
      content: '👥 **Xona a\'zolari chegarasini tanlang:**',
      components: [new ActionRowBuilder().addComponents(limitMenu)],
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  if (customId === 'vc_select_limit' && interaction.isStringSelectMenu()) {
    const limit = parseInt(interaction.values[0], 10);
    await channel.setUserLimit(limit).catch(() => {});

    await interaction.update({
      content: `✅ **Xona chegarasi belgilandi:** ${limit === 0 ? 'Cheksiz' : `${limit} kishi`}!`,
      components: []
    });
    return true;
  }

  // 4. NOM O'ZGARTIRISH (RENAME MODAL)
  if (customId === 'vc_rename') {
    const modal = new ModalBuilder()
      .setCustomId('vc_modal_rename')
      .setTitle('Xona Nomini O\'zgartirish');

    const nameInput = new TextInputBuilder()
      .setCustomId('vc_input_name')
      .setLabel('Yangi xona nomi:')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Masalan: CS2 O\'ynaymiz')
      .setMaxLength(25)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(nameInput));
    await interaction.showModal(modal);
    return true;
  }

  if (customId === 'vc_modal_rename' && interaction.isModalSubmit()) {
    let rawName = interaction.fields.getTextInputValue('vc_input_name').trim();
    if (!rawName.startsWith('🔊・') && !rawName.startsWith('🔊')) {
      rawName = `🔊・${rawName}`;
    }
    const finalName = rawName.slice(0, 32);

    await channel.setName(finalName).catch(err => {
      log.warn('VC Rename xatosi:', err.message);
    });

    await interaction.reply({
      content: `✅ **Xona nomi o'zgartirildi:** \`${finalName}\``,
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  // 5. CHIQARIB YUBORISH / BLOKLASH (KICK & DENY)
  if (customId === 'vc_kick') {
    // Faqat xonada hozir bo'lgan a'zolarni olish (o'zini va botlarni hisobga olmaganda)
    const kickableMembers = channel.members.filter(m => m.id !== user.id && !m.user.bot);

    if (kickableMembers.size === 0) {
      await interaction.reply({
        content: '⚠️ Hozirda ovozli xonangizda sizdan boshqa hech kim yo\'q!',
        flags: MessageFlags.Ephemeral
      });
      return true;
    }

    const options = kickableMembers.map(m => ({
      label: (m.displayName || m.user.username).slice(0, 100),
      description: `@${m.user.tag || m.user.username}`.slice(0, 100),
      value: m.id,
      emoji: '👤'
    })).slice(0, 25);

    const kickSelect = new StringSelectMenuBuilder()
      .setCustomId('vc_select_kick')
      .setPlaceholder('Chiqarib yuboriladigan a\'zoni tanlang...')
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(options);

    await interaction.reply({
      content: '⛔ **Xonangizdan kimni chiqarib yubormoqchisiz?**\nUshbu a\'zo xonadan chiqariladi va qayta kirishi taqiqlanadi.',
      components: [new ActionRowBuilder().addComponents(kickSelect)],
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  if (customId === 'vc_select_kick' && (interaction.isStringSelectMenu() || interaction.isUserSelectMenu())) {
    const targetId = interaction.values[0];

    if (targetId === interaction.user.id) {
      await interaction.update({
        content: '❌ O\'zingizni xonadan chiqara olmaysiz!',
        components: []
      });
      return true;
    }

    // Qayta kirishini taqiqlash
    await channel.permissionOverwrites.edit(targetId, {
      Connect: false
    });

    // Agar hozir ovozli xonada bo'lsa, chiqarib yuborish
    const targetMember = channel.members.get(targetId);
    if (targetMember) {
      await targetMember.voice.disconnect('Xona egasi tomonidan chiqarib yuborildi').catch(() => {});
    }

    await interaction.update({
      content: `✅ <@${targetId}> xonadan chiqarildi va qayta kirishi taqiqlandi!`,
      components: []
    });
    return true;
  }

  // 6. XONANI YOPISH (CLOSE ROOM)
  if (customId === 'vc_close_room') {
    if (!isOwner && !isStaff) {
      await interaction.reply({
        content: '❌ Ushbu xonani faqat xona egasi yoki administratorlar yopa oladi!',
        flags: MessageFlags.Ephemeral
      });
      return true;
    }

    const settings = storage.getGuildSettings(guild.id);
    const joinToCreateId = settings.tempVoice?.channelId;
    const categoryId = settings.tempVoice?.categoryId;

    // Asosiy ovozli kanalni topish
    const mainVoiceChannel = findMainVoiceChannel(guild, channel.id, joinToCreateId, categoryId);

    await interaction.reply({
      content: `🔒 Xona yopilmoqda... Qolgan foydalanuvchilar ${mainVoiceChannel ? `<#${mainVoiceChannel.id}> ga ko'chirilmoqda` : "chiqarilmoqda"}.`,
      flags: MessageFlags.Ephemeral
    }).catch(() => {});

    // Xonada qolib ketgan barcha a'zolarni ko'chirish
    const membersToMove = [...channel.members.values()];
    for (const m of membersToMove) {
      if (mainVoiceChannel) {
        await m.voice.setChannel(mainVoiceChannel).catch(() => {});
      } else {
        await m.voice.disconnect('Xona yopildi').catch(() => {});
      }
    }

    tempChannelOwners.delete(channel.id);
    activeTempChannels.delete(channel.id);

    await channel.delete().catch(() => {});
    return true;
  }

  return false;
}

/**
 * Serverdagi asosiy / ochiq ovozli kanalni topish
 */
function findMainVoiceChannel(guild, currentChannelId, joinToCreateId, categoryId) {
  // 1. "asosiy", "ovozli chat", "general", "main" nomli ovozli kanallarni qidirish
  const preferred = guild.channels.cache.find(c =>
    c.isVoiceBased() &&
    c.id !== currentChannelId &&
    c.id !== joinToCreateId &&
    c.parentId !== categoryId &&
    (c.name.toLowerCase().includes('asosiy') ||
     c.name.toLowerCase().includes('ovozli') ||
     c.name.toLowerCase().includes('general') ||
     c.name.toLowerCase().includes('main') ||
     c.name.toLowerCase().includes('chat'))
  );
  if (preferred) return preferred;

  // 2. Aks holda boshqa birinchi ochiq ovozli kanal
  return guild.channels.cache.find(c =>
    c.isVoiceBased() &&
    c.id !== currentChannelId &&
    c.id !== joinToCreateId &&
    c.parentId !== categoryId
  ) || null;
}

module.exports = {
  sendRoomControlPanel,
  handleTempVoiceInteraction,
  tempChannelOwners,
  activeTempChannels
};
