const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  RoleSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const storage = require('../../config/storage');

const MODE_NAMES = {
  voice_or_messages: '🎙️ Ovoz YOKI 💬 Chat (Birortasi yetarli)',
  voice_only: '🎙️ Faqat ovozli xonada o\'tirish',
  messages_only: '💬 Faqat chatda xabar yozish',
  voice_and_messages: '⚡ Ovoz VA Chat (Ikkalasi ham shart)'
};

/**
 * Chetlatilgan maxsus rollarga ega a'zolardan Active rolni yechib olish
 */
async function purgeActiveRoleFromIgnored(guild, settings) {
  if (!settings.roleId || !Array.isArray(settings.ignoredRoles) || settings.ignoredRoles.length === 0) {
    return 0;
  }

  const activeRole = guild.roles.cache.get(settings.roleId) || await guild.roles.fetch(settings.roleId).catch(() => null);
  if (!activeRole) return 0;

  const botMember = guild.members.me || await guild.members.fetchMe().catch(() => null);
  if (!botMember || botMember.roles.highest.position <= activeRole.position) return 0;

  let strippedCount = 0;
  const members = await guild.members.fetch().catch(() => guild.members.cache);

  for (const [, member] of members) {
    if (member.user.bot) continue;
    if (member.roles.cache.has(activeRole.id)) {
      const hasIgnored = member.roles.cache.some(r => settings.ignoredRoles.includes(r.id));
      if (hasIgnored) {
        try {
          await member.roles.remove(activeRole, 'A\'zoda maxsus rol borligi sababli Active roli olib tashlandi');
          storage.updateMemberActivity(guild.id, member.id, { hasRole: false });
          strippedCount++;
        } catch (err) {
          console.error(`[PURGE ACTIVE ROLE XATOSI] ${member.user.tag}:`, err.message);
        }
      }
    }
  }

  return strippedCount;
}

/**
 * Embed panelini yasash
 */
function buildActiveRoleEmbed(guild, settings, actionText = null) {
  const isEnabled = settings.enabled && settings.roleId;
  const isSilent = settings.sendMessage === false || settings.silent === true;
  const sendMsgText = isSilent
    ? '🔇 **Jim rejim (Aytib o\'tirmay beradi, xabarsiz)**'
    : (settings.logChannelId ? `📢 **Yoqilgan (<#${settings.logChannelId}> ga yuboriladi)**` : '⚠️ **Kanal belgilanmagan (xabar yuborilmaydi)**');

  const ignoredList = Array.isArray(settings.ignoredRoles) && settings.ignoredRoles.length > 0
    ? settings.ignoredRoles.map(rId => `<@&${rId}>`).join(', ')
    : '*Hech qanday maxsus rol chetlatilmagan (Barcha a\'zolarga beriladi)*';

  const embed = new EmbedBuilder()
    .setColor(isEnabled ? 0x57F287 : 0xFEE75C)
    .setTitle('⚙️ Kunlik Faollik Roli Tizimi Sozlamalari')
    .setDescription(
      `${actionText ? `### 📝 O'zgarish:\n${actionText}\n\n` : ''}` +
      `**Tizim Holati:** ${isEnabled ? '🟢 **Faol (Yoqilgan)**' : '🔴 **O\'chirilgan / Sozlanmagan**'}\n\n` +
      `• 🎖️ **Beriladigan Rol:** ${settings.roleId ? `<@&${settings.roleId}>` : '*Belgilanmagan*'}\n` +
      `• 🎙️ **Talab qilinadigan ovoz:** **${settings.voiceMinutes || 45} daqiqa**\n` +
      `• 💬 **Talab qilinadigan xabar:** **${settings.messageCount || 20} ta**\n` +
      `• 🎯 **Hisoblash Tartibi:** ${MODE_NAMES[settings.mode] || MODE_NAMES.voice_or_messages}\n` +
      `• 📢 **E'lon / Log Kanali:** ${settings.logChannelId ? `<#${settings.logChannelId}>` : '*O\'rnatilmagan*'}\n` +
      `• 🔕 **Xabar / Bildirishnoma:** ${sendMsgText}\n\n` +
      `• 🚫 **Chetlatilgan Maxsus Rollar:**\n${ignoredList}\n` +
      `*(Ushbu roldagi a'zolar qanchalik faol bo'lmasin, ularga @ACTIVE roli berilmaydi)*\n\n` +
      `• ⏳ **Ertasiga kirmasa:** Rol avtomatik olib tashlanadi (Inactivity Removal)`
    )
    .addFields(
      {
        name: '💡 Qanday sozlash mumkin?',
        value:
          '• **Maxsus rollarni tanlash:** Pastdagi menyudan `@ACTIVE` berilmaydigan rollarni bittalab yoki bir nechtasini belgilang.\n' +
          '• **Tezkor buyruq:** `/set-active-role exclude_role:@Moderator`\n' +
          '• **Jim rejim:** `/set-active-role silent:True`\n' +
          '• **O\'chirish:** `/set-active-role disable:True`'
      }
    )
    .setFooter({ text: 'Cleva • Daily Active Role System' })
    .setTimestamp();

  return embed;
}

/**
 * Interaktiv komponentlarni (Role Select va Tugmalar) yasash
 */
function buildActiveRoleComponents(settings) {
  const roleSelectRow = new ActionRowBuilder().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId('active_role_exclude_select')
      .setPlaceholder('🚫 @ACTIVE berilmaydigan maxsus rollarni tanlang...')
      .setMinValues(0)
      .setMaxValues(25)
  );

  const buttonRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('active_role_clear_excluded')
      .setLabel('🧹 Chetlatilganlarni Tozalash')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('active_role_purge_now')
      .setLabel('⚡ Maxsus Rollardagi @ACTIVE ni Yechib Olish')
      .setStyle(ButtonStyle.Danger)
  );

  return [roleSelectRow, buttonRow];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set-active-role')
    .setDescription('Kunlik faol a\'zolarga avtomat rol berish va kirmasa olib tashlash tizimini sozlaydi')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)
    .addRoleOption(option =>
      option.setName('role')
        .setDescription('Kunlik faollik normasini bajarganlarga beriladigan maxsus rol')
        .setRequired(false)
    )
    .addIntegerOption(option =>
      option.setName('voice_minutes')
        .setDescription('Talab qilinadigan kunlik ovozli vaqt (daqiqada, masalan: 45)')
        .setMinValue(1)
        .setMaxValue(720)
        .setRequired(false)
    )
    .addIntegerOption(option =>
      option.setName('messages_count')
        .setDescription('Talab qilinadigan kunlik xabarlar soni (masalan: 20)')
        .setMinValue(1)
        .setMaxValue(1000)
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('mode')
        .setDescription('Faollikni qanday hisoblash kerak?')
        .addChoices(
          { name: '🎙️ Ovoz YOKI 💬 Chat (Birortasi bajarilsa yetarli)', value: 'voice_or_messages' },
          { name: '🎙️ Faqat ovozli xona vaqti', value: 'voice_only' },
          { name: '💬 Faqat chatdagi xabarlar soni', value: 'messages_only' },
          { name: '⚡ Ovoz VA Chat (Ikkalasi ham bajarilishi shart)', value: 'voice_and_messages' }
        )
        .setRequired(false)
    )
    .addRoleOption(option =>
      option.setName('exclude_role')
        .setDescription('🚫 Maxsus rol qo\'shish (ushbu roldagi a\'zolarga @ACTIVE berilmaydi)')
        .setRequired(false)
    )
    .addRoleOption(option =>
      option.setName('remove_excluded_role')
        .setDescription('Chetlatilgan rolni ro\'yxatdan chiqarish')
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option.setName('clear_excluded_roles')
        .setDescription('Barcha chetlatilgan maxsus rollar ro\'yxatini tozalash')
        .setRequired(false)
    )
    .addChannelOption(option =>
      option.setName('log_channel')
        .setDescription('Tabriknoma va rol yangilanishlari chiqadigan kanal')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option.setName('send_message')
        .setDescription('Rol berilganda xabar jo\'natish (False = aytib o\'tirmay, jim beradi)')
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option.setName('silent')
        .setDescription('Jim rejim: aytib o\'tirmasdan rol berish (True = xabarsiz, jim beradi)')
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option.setName('clear_log_channel')
        .setDescription('Tabriknoma kanalini o\'chirib tashlash (tozalash)')
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option.setName('status')
        .setDescription('Tizim holati (True = Yoqish, False = To\'xtatib turish)')
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option.setName('disable')
        .setDescription('Faollik roli tizimini butunlay o\'chirib qo\'yish')
        .setRequired(false)
    ),

  async execute(interaction) {
    const { guild } = interaction;
    const role = interaction.options.getRole('role');
    const voiceMinutes = interaction.options.getInteger('voice_minutes');
    const messagesCount = interaction.options.getInteger('messages_count');
    const mode = interaction.options.getString('mode');
    const logChannel = interaction.options.getChannel('log_channel');
    const excludeRole = interaction.options.getRole('exclude_role');
    const removeExcludedRole = interaction.options.getRole('remove_excluded_role');
    const clearExcludedRoles = interaction.options.getBoolean('clear_excluded_roles');
    const sendMessageOpt = interaction.options.getBoolean('send_message');
    const silentOpt = interaction.options.getBoolean('silent');
    const clearLogChannel = interaction.options.getBoolean('clear_log_channel');
    const status = interaction.options.getBoolean('status');
    const disable = interaction.options.getBoolean('disable');

    const settings = storage.getActiveRoleSettings(guild.id);

    // 1. BUTUNLAY O'CHIRISH (Disable)
    if (disable) {
      storage.updateActiveRoleSettings(guild.id, {
        enabled: false,
        roleId: null,
        logChannelId: null
      });

      const disableEmbed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('🔴 Kunlik Faollik Roli Tizimi O\'chirildi')
        .setDescription('Serverda kunlik faollik bo\'yicha rol berish tizimi to\'xtatildi.')
        .setFooter({ text: 'Qayta yoqish uchun: /set-active-role role:[Rol]' })
        .setTimestamp();

      return interaction.reply({ embeds: [disableEmbed] });
    }

    // 2. PARAMETR KIRITILMAGAN BO'LSA — JORIY HOLATNI KO'RSATISH (Interaktiv menyu bilan)
    const hasAnyOption = role ||
      voiceMinutes !== null ||
      messagesCount !== null ||
      mode ||
      logChannel ||
      excludeRole ||
      removeExcludedRole ||
      clearExcludedRoles ||
      sendMessageOpt !== null ||
      silentOpt !== null ||
      clearLogChannel ||
      status !== null;

    let changesText = null;

    if (hasAnyOption) {
      // Bot ierarxiyasini tekshirish
      if (role) {
        const botMember = guild.members.me;
        if (botMember && botMember.roles.highest.position <= role.position) {
          return interaction.reply({
            content: `❌ Botning roli (**${botMember.roles.highest.name}**) siz tanlagan roldan (**${role.name}**) pastda yoki teng! Iltimos, server sozlamalarida bot rolini yuqoriroqqa qo'ying.`,
            ephemeral: true
          });
        }
      }

      const updatePayload = {};
      const changesList = [];

      if (role) {
        updatePayload.roleId = role.id;
        changesList.push(`• Faollik roli <@&${role.id}> ga o'rnatildi.`);
      }
      if (voiceMinutes !== null) {
        updatePayload.voiceMinutes = voiceMinutes;
        changesList.push(`• Kunlik ovoz normasi: **${voiceMinutes} daqiqa**.`);
      }
      if (messagesCount !== null) {
        updatePayload.messageCount = messagesCount;
        changesList.push(`• Kunlik xabar normasi: **${messagesCount} ta**.`);
      }
      if (mode) {
        updatePayload.mode = mode;
        changesList.push(`• Hisoblash tartibi: **${MODE_NAMES[mode] || mode}**.`);
      }
      if (logChannel) {
        updatePayload.logChannelId = logChannel.id;
        changesList.push(`• Tabriknoma kanali <#${logChannel.id}> ga o'rnatildi.`);
      }
      if (clearLogChannel) {
        updatePayload.logChannelId = null;
        changesList.push('• Tabriknoma kanali tozalandi.');
      }

      // Maxsus rollarni chetlatish (Exclude / Ignore)
      let currentIgnored = Array.isArray(settings.ignoredRoles) ? [...settings.ignoredRoles] : [];
      if (excludeRole) {
        if (!currentIgnored.includes(excludeRole.id)) {
          currentIgnored.push(excludeRole.id);
          updatePayload.ignoredRoles = currentIgnored;
          changesList.push(`• 🚫 Chetlatilgan rol qo'shildi: <@&${excludeRole.id}> (ushbu roldagilarga @ACTIVE berilmaydi).`);
        } else {
          changesList.push(`• ℹ️ <@&${excludeRole.id}> allaqachon chetlatilgan rollar ro'yxatida bor.`);
        }
      }
      if (removeExcludedRole) {
        currentIgnored = currentIgnored.filter(id => id !== removeExcludedRole.id);
        updatePayload.ignoredRoles = currentIgnored;
        changesList.push(`• ✅ <@&${removeExcludedRole.id}> chetlatilganlar ro'yxatidan chiqarildi.`);
      }
      if (clearExcludedRoles) {
        updatePayload.ignoredRoles = [];
        changesList.push('• 🧹 Barcha chetlatilgan maxsus rollar tozalandi.');
      }

      if (sendMessageOpt !== null) {
        updatePayload.sendMessage = sendMessageOpt;
        updatePayload.silent = !sendMessageOpt;
        changesList.push(`• Xabar jo'natish: **${sendMessageOpt ? 'Yoqildi' : 'O\'chirildi (Jim rejim)'}**.`);
      }
      if (silentOpt !== null) {
        updatePayload.sendMessage = !silentOpt;
        updatePayload.silent = silentOpt;
        changesList.push(`• Jim rejim: **${silentOpt ? 'Yoqildi' : 'O\'chirildi'}**.`);
      }

      if (status !== null) {
        updatePayload.enabled = status;
        changesList.push(`• Tizim: **${status ? 'Yoqildi' : 'To\'xtatildi'}**.`);
      } else if (role || updatePayload.roleId || settings.roleId) {
        updatePayload.enabled = true;
      }

      const updatedSettings = storage.updateActiveRoleSettings(guild.id, updatePayload);

      // Agar chetlatilgan rollar qo'shilgan bo'lsa, o'sha roldagi a'zolardan @ACTIVE ni yechib olish
      if (excludeRole || updatePayload.ignoredRoles) {
        const purged = await purgeActiveRoleFromIgnored(guild, updatedSettings);
        if (purged > 0) {
          changesList.push(`• ⚡ Maxsus rolga ega **${purged} ta** a'zodan mavjud @ACTIVE roli olib tashlandi.`);
        }
      }

      changesText = changesList.join('\n');
    }

    const currentSettings = storage.getActiveRoleSettings(guild.id);
    const embed = buildActiveRoleEmbed(guild, currentSettings, changesText);
    const components = buildActiveRoleComponents(currentSettings);

    const replyMessage = await interaction.reply({
      embeds: [embed],
      components,
      fetchReply: true
    });

    // Interaktiv collector (5 daqiqa faol bo'ladi)
    const collector = replyMessage.createMessageComponentCollector({
      filter: i => i.user.id === interaction.user.id,
      time: 300_000
    });

    collector.on('collect', async i => {
      const liveSettings = storage.getActiveRoleSettings(guild.id);
      let actionInfo = '';

      if (i.customId === 'active_role_exclude_select') {
        const selected = i.values.filter(rId => rId !== guild.id);
        liveSettings.ignoredRoles = selected;
        storage.updateActiveRoleSettings(guild.id, { ignoredRoles: selected });

        const purged = await purgeActiveRoleFromIgnored(guild, liveSettings);
        actionInfo = `• 🚫 Chetlatilgan rollar yangilandi (${selected.length} ta rol tanlandi).` +
          (purged > 0 ? `\n• ⚡ Maxsus rolga ega **${purged} ta** a'zodan @ACTIVE roli yechib olindi.` : '');
      } else if (i.customId === 'active_role_clear_excluded') {
        liveSettings.ignoredRoles = [];
        storage.updateActiveRoleSettings(guild.id, { ignoredRoles: [] });
        actionInfo = '• 🧹 Barcha chetlatilgan maxsus rollar tozalandi.';
      } else if (i.customId === 'active_role_purge_now') {
        const purged = await purgeActiveRoleFromIgnored(guild, liveSettings);
        actionInfo = purged > 0
          ? `• ⚡ Maxsus rolga ega bo'lgan **${purged} ta** a'zodan @ACTIVE roli muvaffaqiyatli yechib olindi.`
          : '• ℹ️ Hozirda maxsus rolga ega bo\'lib @ACTIVE rolini ushlab turgan a\'zo topilmadi.';
      }

      const newEmbed = buildActiveRoleEmbed(guild, liveSettings, actionInfo);
      const newComponents = buildActiveRoleComponents(liveSettings);

      await i.update({
        embeds: [newEmbed],
        components: newComponents
      }).catch(() => {});
    });

    collector.on('end', () => {
      replyMessage.edit({
        components: []
      }).catch(() => {});
    });
  }
};
