const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
  PermissionFlagsBits
} = require('discord.js');
const storage = require('../config/storage');
const log = require('./log');

/**
 * MEGA TEAM rasmiy a'zo dosye kartochkasi Embedini yaratadi
 */
function createTeamCardEmbed(member, data, targetUser) {
  const joinedTimestamp = data.joinedAt
    ? Math.floor(new Date(data.joinedAt).getTime() / 1000)
    : (member?.joinedTimestamp ? Math.floor(member.joinedTimestamp / 1000) : Math.floor(Date.now() / 1000));

  const embed = new EmbedBuilder()
    .setColor(0xF1C40F)
    .setAuthor({
      name: 'MEGA TEAM • RASMIY A\'ZO DOSYESI',
      iconURL: targetUser.displayAvatarURL()
    })
    .setTitle(`🎖️ ${data.fullName || targetUser.displayName || targetUser.username} (${data.age ? data.age + ' yosh' : 'Noma\'lum'})`)
    .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
    .setDescription(
      `👤 **A'zo:** <@${targetUser.id}> (\`${targetUser.tag || targetUser.username}\`)\n` +
      `🆔 **Discord ID:** \`${targetUser.id}\`\n` +
      `📅 **Jamoaga qo'shilgan vaqti:** <t:${joinedTimestamp}:F> (<t:${joinedTimestamp}:R>)`
    )
    .addFields(
      {
        name: '🎮 Asosiy O\'yin va Roli',
        value: data.mainGameRole || 'Ko\'rsatilmagan',
        inline: true
      },
      {
        name: '💼 Jamoada Vazifasi / Lavozimi',
        value: data.teamPosition || 'Ko\'rsatilmagan',
        inline: true
      },
      {
        name: '⚡ O\'yin Tajribasi / Reytingi',
        value: data.experienceRank || 'Ko\'rsatilmagan',
        inline: false
      },
      {
        name: '📱 Aloqa & Profil Ma\'lumotlari',
        value: data.contactInfo || 'Ko\'rsatilmagan',
        inline: false
      }
    )
    .setFooter({
      text: `MEGA TEAM ARCHIVE • ID: ${targetUser.id} • Oxirgi yangilanish`
    })
    .setTimestamp(data.updatedAt ? new Date(data.updatedAt) : new Date());

  return embed;
}

/**
 * #team-arxivi kanaliga qo'yiladigan boshqaruv paneli Embedi
 */
function createArchivePanelEmbed() {
  return new EmbedBuilder()
    .setColor(0x2B2D31)
    .setTitle('📁 MEGA TEAM — A\'zo Dosye Kartochkasi')
    .setDescription(
      'Ushbu kanalda server a\'zolari o\'z dosye kartochkalarini to\'ldirishlari va jamoa arxivida ro\'yxatdan o\'tishlari mumkin.\n\n' +
      '📌 **Qoidalar va Ko\'rsatmalar:**\n' +
      '• Har bir a\'zo o\'zining aniq va to\'g\'ri ma\'lumotlarini kiritishi lozim.\n' +
      '• Kartochka orqali yoshingiz, o\'yin tajribangiz, asosiy o\'yiningiz va vazifangiz qayd etiladi.\n' +
      '• To\'ldirilgan kartochkangiz rahbariyat va jamoa arxivida saqlanadi.\n' +
      '• Ma\'lumotlaringiz o\'zgarganda kartochkangizni istalgan payt qayta yangilashingiz mumkin.\n\n' +
      '👇 **O\'z kartochkangizni to\'ldirish yoki ma\'lumotlaringizni yangilash uchun pastdagi tugmani bosing:**'
    )
    .setFooter({ text: 'MEGA TEAM ARCHIVE • A\'zolar Kartochkalari' })
    .setTimestamp();
}

/**
 * Kartochka to'ldirish uchun Modal oynasini ko'rsatish
 */
async function showTeamCardModal(interaction, existingData = null, targetUserId = null) {
  const targetId = targetUserId || interaction.user.id;
  const modal = new ModalBuilder()
    .setCustomId(`team_card_modal_${targetId}`)
    .setTitle('📝 MEGA TEAM Kartochkasi');

  // 1. Ism va Yosh
  let nameAgeValue = '';
  if (existingData?.fullName) {
    nameAgeValue = existingData.age ? `${existingData.fullName}, ${existingData.age}` : existingData.fullName;
  }
  const nameAgeInput = new TextInputBuilder()
    .setCustomId('card_name_age')
    .setLabel('F.I.Sh va Yoshingiz:')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Masalan: Ali Valiyev, 19 yosh')
    .setMaxLength(60)
    .setRequired(true);
  if (nameAgeValue) nameAgeInput.setValue(nameAgeValue);

  // 2. Asosiy o'yin va roli
  const gameRoleInput = new TextInputBuilder()
    .setCustomId('card_game_role')
    .setLabel('Asosiy o\'yin va o\'yindagi rolingiz:')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Masalan: CS2 (Sniper/AWP) yoki Dota 2 (Carry)')
    .setMaxLength(100)
    .setRequired(true);
  if (existingData?.mainGameRole) gameRoleInput.setValue(existingData.mainGameRole);

  // 3. Jamoada vazifasi
  const positionInput = new TextInputBuilder()
    .setCustomId('card_team_position')
    .setLabel('Jamoada vazifangiz / lavozimingiz:')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Masalan: Asosiy Tarkib, Moderator, Dizayner')
    .setMaxLength(100)
    .setRequired(true);
  if (existingData?.teamPosition) positionInput.setValue(existingData.teamPosition);

  // 4. Tajriba va reyting
  const expRankInput = new TextInputBuilder()
    .setCustomId('card_exp_rank')
    .setLabel('O\'yin tajribangiz / Reytingingiz:')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Masalan: Faceit 10 Lvl (2400 ELO), 4 yillik tajriba')
    .setMaxLength(250)
    .setRequired(true);
  if (existingData?.experienceRank) expRankInput.setValue(existingData.experienceRank);

  // 5. Aloqa va qo'shimcha
  const contactInput = new TextInputBuilder()
    .setCustomId('card_contact')
    .setLabel('Aloqa (Telegram, Steam, tel):')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Masalan: Telegram: @ali_mega, Steam: /id/aliv')
    .setMaxLength(150)
    .setRequired(true);
  if (existingData?.contactInfo) contactInput.setValue(existingData.contactInfo);

  modal.addComponents(
    new ActionRowBuilder().addComponents(nameAgeInput),
    new ActionRowBuilder().addComponents(gameRoleInput),
    new ActionRowBuilder().addComponents(positionInput),
    new ActionRowBuilder().addComponents(expRankInput),
    new ActionRowBuilder().addComponents(contactInput)
  );

  await interaction.showModal(modal);
}

/**
 * Team archive interaksiyalarini (tugma va modallar) boshqaradi
 */
async function handleTeamArchiveInteraction(interaction) {
  const { guild } = interaction;
  if (!guild) return false;

  // 1. TUGMA BOSILGANDA (Panel yoki Kartochka ichidagi tugma)
  if (interaction.isButton()) {
    // A) Boshqaruv panelidagi '📝 Yangi Kartochka To'ldirish' tugmasi
    if (interaction.customId === 'team_archive_create_btn') {
      const existingData = storage.getTeamMember(guild.id, interaction.user.id);
      await showTeamCardModal(interaction, existingData, interaction.user.id);
      return true;
    }

    // B) Kartochka ostidagi '✏️ Tahrirlash' tugmasi
    if (interaction.customId.startsWith('team_card_edit_btn_')) {
      const targetUserId = interaction.customId.replace('team_card_edit_btn_', '');
      const settings = storage.getGuildSettings(guild.id);
      const headRoleId = settings.teamArchive?.headRoleId;

      const isOwner = interaction.user.id === targetUserId;
      const isHead = headRoleId && interaction.member.roles.cache.has(headRoleId);
      const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);

      if (!isOwner && !isHead && !isAdmin) {
        await interaction.reply({
          content: '❌ Ushbu kartochkani faqat uning egasi yoki Rahbariyat tahrirlashi mumkin!',
          flags: MessageFlags.Ephemeral
        });
        return true;
      }

      const existingData = storage.getTeamMember(guild.id, targetUserId);
      await showTeamCardModal(interaction, existingData, targetUserId);
      return true;
    }
  }

  // 2. MODAL YUBORILGANDA (team_card_modal_...)
  if (interaction.isModalSubmit() && interaction.customId.startsWith('team_card_modal_')) {
    const targetUserId = interaction.customId.replace('team_card_modal_', '');
    const settings = storage.getGuildSettings(guild.id);

    // Kiritilgan qiymatlarni olish
    const rawNameAge = interaction.fields.getTextInputValue('card_name_age').trim();
    const mainGameRole = interaction.fields.getTextInputValue('card_game_role').trim();
    const teamPosition = interaction.fields.getTextInputValue('card_team_position').trim();
    const experienceRank = interaction.fields.getTextInputValue('card_exp_rank').trim();
    const contactInfo = interaction.fields.getTextInputValue('card_contact').trim();

    // Ism va Yoshni ajratish (masalan: "Ali Valiyev, 19 yosh" yoki "Ali 19")
    let fullName = rawNameAge;
    let age = '';
    const parts = rawNameAge.split(/[,–-]/);
    if (parts.length >= 2) {
      fullName = parts[0].trim();
      const ageMatch = parts[1].match(/\d+/);
      if (ageMatch) age = ageMatch[0];
    } else {
      const ageMatch = rawNameAge.match(/\b(\d{2})\b/);
      if (ageMatch) {
        age = ageMatch[1];
        fullName = rawNameAge.replace(ageMatch[0], '').replace(/yosh/i, '').trim();
      }
    }

    const existingData = storage.getTeamMember(guild.id, targetUserId) || {};
    const joinedAt = existingData.joinedAt || new Date().toISOString();

    const updatedData = {
      ...existingData,
      userId: targetUserId,
      fullName: fullName || rawNameAge,
      age: age || (existingData.age || ''),
      mainGameRole,
      teamPosition,
      experienceRank,
      contactInfo,
      joinedAt
    };

    // Ma'lumotlarni saqlash
    storage.saveTeamMember(guild.id, targetUserId, updatedData);

    // Target a'zo va foydalanuvchini olish
    const targetMember = await guild.members.fetch(targetUserId).catch(() => null);
    const targetUser = targetMember ? targetMember.user : await guild.client.users.fetch(targetUserId).catch(() => interaction.user);

    // Embed va tahrirlash tugmasini tayyorlash
    const cardEmbed = createTeamCardEmbed(targetMember, updatedData, targetUser);
    const cardRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`team_card_edit_btn_${targetUserId}`)
        .setLabel('✏️ Kartochkani Tahrirlash')
        .setStyle(ButtonStyle.Secondary)
    );

    // Agar arxiv kanali belgilangan bo'lsa, kanalga jo'natish yoki mavjud xabarni yangilash
    let channelNotice = '';
    const archiveChannelId = settings.teamArchive?.channelId;
    if (archiveChannelId) {
      const archiveChannel = guild.channels.cache.get(archiveChannelId) || await guild.channels.fetch(archiveChannelId).catch(() => null);
      if (archiveChannel && archiveChannel.isTextBased()) {
        try {
          const pingText = settings.teamArchive?.pingRoleId ? `<@&${settings.teamArchive.pingRoleId}> ` : '';
          if (existingData.messageId) {
            // Mavjud kartochka xabarini yangilash
            const existingMsg = await archiveChannel.messages.fetch(existingData.messageId).catch(() => null);
            if (existingMsg) {
              await existingMsg.edit({ embeds: [cardEmbed], components: [cardRow] });
              channelNotice = `\n📁 Kartochkangiz <#${archiveChannel.id}> kanalida yangilandi.`;
            } else {
              const newMsg = await archiveChannel.send({
                content: `${pingText}📋 **A'zo kartochkasi yangilandi:** <@${targetUserId}>`,
                embeds: [cardEmbed],
                components: [cardRow]
              });
              storage.saveTeamMember(guild.id, targetUserId, { messageId: newMsg.id });
              channelNotice = `\n📁 Yangi kartochka <#${archiveChannel.id}> kanaliga joylandi.`;
            }
          } else {
            // Yangi kartochka xabari jo'natish
            const newMsg = await archiveChannel.send({
              content: `${pingText}🆕 **Yangi a'zo kartochkasi topshirildi:** <@${targetUserId}>`,
              embeds: [cardEmbed],
              components: [cardRow]
            });
            storage.saveTeamMember(guild.id, targetUserId, { messageId: newMsg.id });
            channelNotice = `\n📁 Kartochkangiz <#${archiveChannel.id}> kanaliga muvaffaqiyatli yuborildi!`;
          }
        } catch (err) {
          log.error('[TEAM ARCHIVE POST ERROR]:', err);
          channelNotice = `\n⚠️ Kanalga yuborishda xatolik: ${err.message}`;
        }
      } else {
        channelNotice = '\n⚠️ Belgilangan arxiv kanali topilmadi yoki bot u yerda yoza olmaydi.';
      }
    } else {
      channelNotice = '\nℹ️ *Eslatma: Hozircha arxiv kanali belgilanmagan. Administrator `/set-team-archive-chat channel:[kanal]` orqali kanalni belgilashi mumkin.*';
    }

    await interaction.reply({
      content: `✅ **A'zo kartochkasi muvaffaqiyatli saqlandi!**${channelNotice}`,
      embeds: [cardEmbed],
      flags: MessageFlags.Ephemeral
    });

    return true;
  }

  return false;
}

module.exports = {
  createTeamCardEmbed,
  createArchivePanelEmbed,
  showTeamCardModal,
  handleTeamArchiveInteraction
};
