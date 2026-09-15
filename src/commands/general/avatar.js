const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags
} = require('discord.js');

/**
 * Server Icon va Banner uchun Embed va Tugmalarni yasaydi
 */
function buildServerEmbedsAndButtons(guild, view = 'icon') {
  const iconUrl = guild.iconURL({ size: 4096 });
  const bannerUrl = guild.bannerURL({ size: 4096 });

  let currentUrl = '';
  let title = '';
  let description = '';

  if (view === 'icon') {
    currentUrl = iconUrl || bannerUrl;
    title = `🏰 ${guild.name} — Server Iconi (4096px HD)`;
    description = '📌 *Serverning rasmiy profil belgisi (Icon).*';
  } else {
    currentUrl = bannerUrl || iconUrl;
    title = `🎨 ${guild.name} — Server Banneri (4096px HD)`;
    description = '📌 *Serverning fon rasmi (Banner).*';
  }

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(title)
    .setURL(currentUrl)
    .setImage(currentUrl)
    .setDescription(description)
    .setFooter({ text: `Server ID: ${guild.id} • Tugmalar orqali almashtiring` })
    .setTimestamp();

  const switchRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('avatar_btn_srv_icon')
      .setLabel('🏰 Server Iconi')
      .setStyle(view === 'icon' ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(!iconUrl),
    new ButtonBuilder()
      .setCustomId('avatar_btn_srv_banner')
      .setLabel('🎨 Server Banneri')
      .setStyle(view === 'banner' ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(!bannerUrl)
  );

  const linkRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('📥 Rasmni Ochish (4096px)')
      .setStyle(ButtonStyle.Link)
      .setURL(currentUrl)
  );

  return { embeds: [embed], components: [switchRow, linkRow] };
}

/**
 * Foydalanuvchi avatari va banneri uchun Embed va Tugmalarni yasaydi
 */
function buildUserAvatarEmbedsAndButtons(targetUser, member, fetchedUser, view = 'server', guild) {
  const globalAvatar = targetUser.displayAvatarURL({ size: 4096 });
  const serverAvatar = member ? member.avatarURL({ size: 4096 }) : null;
  const userBanner = fetchedUser?.bannerURL ? fetchedUser.bannerURL({ size: 4096 }) : null;

  const displayName = targetUser.displayName || targetUser.username;
  let currentImageUrl = '';
  let embedTitle = '';
  let embedDesc = '';
  let embedColor = 0x5865F2;

  // Qaysi ko'rinish tanlanganini aniqlash
  if (view === 'server') {
    if (serverAvatar) {
      currentImageUrl = serverAvatar;
      embedTitle = `🏰 ${displayName} — Server Avatari (${guild?.name || 'Server'})`;
      embedDesc = '📌 *Foydalanuvchining faqat ushbu server uchun o\'rnatilgan maxsus avatari.*';
      embedColor = 0xFEE75C;
    } else {
      currentImageUrl = globalAvatar;
      embedTitle = `🖼️ ${displayName} — Server Avatari`;
      embedDesc = '📌 *Ushbu a\'zoda alohida server avatari yo\'q (asosiy shaxsiy avatari ko\'rsatilmoqda).*';
      embedColor = 0x5865F2;
    }
  } else if (view === 'global') {
    currentImageUrl = globalAvatar;
    embedTitle = `🖼️ ${displayName} — Asosiy Profil Avatari (Global HD)`;
    embedDesc = '📌 *Foydalanuvchining Discord hisobidagi haqiqiy asosiy shaxsiy avatari.*';
    embedColor = 0x5865F2;
  } else if (view === 'banner') {
    if (userBanner) {
      currentImageUrl = userBanner;
      embedTitle = `🎨 ${displayName} — Profil Banneri`;
      embedDesc = '📌 *Foydalanuvchining Discord profil foni (banneri).*';
      embedColor = 0x2B2D31;
    } else {
      currentImageUrl = globalAvatar;
      embedTitle = `🖼️ ${displayName} — Asosiy Avatari`;
      embedDesc = '⚠️ *Ushbu a\'zoda profil banneri topilmadi.*';
    }
  }

  const embed = new EmbedBuilder()
    .setColor(embedColor)
    .setTitle(embedTitle)
    .setURL(currentImageUrl)
    .setImage(currentImageUrl)
    .setDescription(embedDesc)
    .setFooter({ text: `Foydalanuvchi ID: ${targetUser.id} • Tugmalar orqali almashtiring` })
    .setTimestamp();

  // 1-qator: Ko'rish rejimini almashtirish tugmalari
  const switchRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`avatar_btn_server_${targetUser.id}`)
      .setLabel('🏰 Server Avatari')
      .setStyle(view === 'server' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`avatar_btn_global_${targetUser.id}`)
      .setLabel('🖼️ Asosiy Profil')
      .setStyle(view === 'global' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`avatar_btn_banner_${targetUser.id}`)
      .setLabel('🎨 Profil Banneri')
      .setStyle(view === 'banner' ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(!userBanner)
  );

  // 2-qator: Yuklab olish va to'liq havolalar
  const linkRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('📥 Rasmni Ochish (4096px)')
      .setStyle(ButtonStyle.Link)
      .setURL(currentImageUrl)
  );

  if (currentImageUrl.includes('.gif') || targetUser.avatar?.startsWith('a_')) {
    linkRow.addComponents(
      new ButtonBuilder()
        .setLabel('🎞️ GIF Format')
        .setStyle(ButtonStyle.Link)
        .setURL(currentImageUrl)
    );
  }

  return { embeds: [embed], components: [switchRow, linkRow] };
}

/**
 * Avatar tugmalari bosilganda rasm ko'rinishini almashtiruvchi hodisa
 */
async function handleAvatarInteraction(interaction) {
  if (!interaction.isButton()) return false;
  const { customId, guild, client } = interaction;

  if (!customId.startsWith('avatar_btn_')) return false;

  // 1. Server rasmlari tugmasi
  if (customId === 'avatar_btn_srv_icon' || customId === 'avatar_btn_srv_banner') {
    if (!guild) return false;
    const view = customId === 'avatar_btn_srv_icon' ? 'icon' : 'banner';
    const payload = buildServerEmbedsAndButtons(guild, view);
    await interaction.update(payload).catch(() => {});
    return true;
  }

  // 2. Foydalanuvchi rasmlari tugmasi
  if (
    customId.startsWith('avatar_btn_server_') ||
    customId.startsWith('avatar_btn_global_') ||
    customId.startsWith('avatar_btn_banner_')
  ) {
    let view = 'server';
    let targetUserId = '';

    if (customId.startsWith('avatar_btn_server_')) {
      view = 'server';
      targetUserId = customId.replace('avatar_btn_server_', '');
    } else if (customId.startsWith('avatar_btn_global_')) {
      view = 'global';
      targetUserId = customId.replace('avatar_btn_global_', '');
    } else if (customId.startsWith('avatar_btn_banner_')) {
      view = 'banner';
      targetUserId = customId.replace('avatar_btn_banner_', '');
    }

    const targetUser = await client.users.fetch(targetUserId).catch(() => null);
    if (!targetUser) {
      await interaction.reply({ content: '❌ Foydalanuvchi topilmadi.', flags: MessageFlags.Ephemeral });
      return true;
    }

    const member = guild ? await guild.members.fetch(targetUserId).catch(() => null) : null;
    const fetchedUser = await targetUser.fetch().catch(() => targetUser);

    const payload = buildUserAvatarEmbedsAndButtons(targetUser, member, fetchedUser, view, guild);
    await interaction.update(payload).catch(() => {});
    return true;
  }

  return false;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('avatar')
    .setDescription('Foydalanuvchi yoki Server rasmini ko\'rsatadi (Tugmalar bilan almashtirish mumkin)')
    .addStringOption(option =>
      option.setName('type')
        .setDescription('Kimning/nimaning rasmini ko\'rmoqchisiz?')
        .setRequired(false)
        .addChoices(
          { name: 'O\'zimning avatarim', value: 'self' },
          { name: 'Server rasmi (Icon & Banner)', value: 'server' },
          { name: 'Boshqa foydalanuvchi', value: 'user' }
        )
    )
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Foydalanuvchi (agar "user" tanlansa)')
        .setRequired(false)
    ),

  async execute(interaction) {
    const type = interaction.options.getString('type');
    const targetUserOption = interaction.options.getUser('user');
    const guild = interaction.guild;

    // 1. SERVER RASMI (Icon & Banner) TANLANGAN BO'LSA
    if (type === 'server') {
      if (!guild) {
        return interaction.reply({
          content: '❌ Ushbu buyruq faqat server ichida ishlaydi.',
          flags: MessageFlags.Ephemeral
        });
      }

      const iconUrl = guild.iconURL({ size: 4096 });
      const bannerUrl = guild.bannerURL({ size: 4096 });

      if (!iconUrl && !bannerUrl) {
        return interaction.reply({
          content: '❌ Ushbu serverda rasm (icon) yoki banner o\'rnatilmagan.',
          flags: MessageFlags.Ephemeral
        });
      }

      const payload = buildServerEmbedsAndButtons(guild, 'icon');
      return interaction.reply(payload);
    }

    // 2. FOYDALANUVCHI AVATARI (Standart holatda birinchi Server Avatari chiqadi)
    const targetUser = targetUserOption || interaction.user;
    const member = guild ? await guild.members.fetch(targetUser.id).catch(() => null) : null;
    const fetchedUser = await targetUser.fetch().catch(() => targetUser);

    const payload = buildUserAvatarEmbedsAndButtons(targetUser, member, fetchedUser, 'server', guild);
    return interaction.reply(payload);
  },

  handleAvatarInteraction
};
