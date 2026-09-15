const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, PermissionFlagsBits } = require('discord.js');
const log = require('./log');

// Faol LFG sessiyalari xotirasi: lfgId -> lfgData
const activeLfgs = new Map();

/**
 * LFG Embedini shakllantirish
 */
function buildLfgEmbed(lfg, guild) {
  const isFull = lfg.participants.length >= lfg.maxPlayers;
  const isClosed = lfg.closed || isFull;

  let color = 0x5865F2; // Moviy
  if (isFull) color = 0x57F287; // Yashil (to'ldi)
  if (lfg.closed && !isFull) color = 0xED4245; // Qizil (yopildi)

  const participantsList = lfg.participants.map((uid, index) => {
    const isHost = uid === lfg.hostId;
    return `${index + 1}. <@${uid}> ${isHost ? '👑 *(Tashkilotchi)*' : ''}`;
  }).join('\n');

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`🎮 O'yinga Sherik Qidirilmoqda: ${lfg.game}`)
    .setDescription(
      isFull
        ? '🎉 **Jamoa to\'liq yig\'ildi! Barcha o\'yinchilar ovozli kanalga taklif qilinadi.**'
        : (lfg.closed
            ? '🔒 **Ushbu qidiruv tashkilotchi tomonidan yopildi.**'
            : '🚀 **Yangi o\'yin uchun do\'stlar qidirilmoqda! Quyidagi tugma orqali qo\'shiling.**')
    )
    .addFields(
      { name: '👑 Tashkilotchi', value: `<@${lfg.hostId}>`, inline: true },
      { name: '🎮 O\'yin', value: `\`${lfg.game}\``, inline: true },
      { name: '👥 Jamoa holati', value: `\`${lfg.participants.length} / ${lfg.maxPlayers}\` ta o'yinchi`, inline: true },
      { name: '🎙️ Ovozli kanal', value: lfg.voiceChannelId ? `<#${lfg.voiceChannelId}>` : '*Belgilanmagan*', inline: true },
      { name: '🏆 Daraja / Rank', value: lfg.rank ? `\`${lfg.rank}\`` : '*Farqi yo\'q*', inline: true },
      { name: '📝 Qo\'shimcha izoh', value: lfg.note ? `*${lfg.note}*` : '*Izoh qoldirilmagan*', inline: false },
      { name: `📋 Jamoa A'zolari (${lfg.participants.length}/${lfg.maxPlayers})`, value: participantsList || '*Hozircha hech kim yo\'q*' }
    )
    .setFooter({ text: `LFG ID: ${lfg.id} • MEGA TEAM Gaming Hub` })
    .setTimestamp();

  return embed;
}

/**
 * LFG Boshqaruv Tugmalarini shakllantirish
 */
function buildLfgButtons(lfg) {
  const isFull = lfg.participants.length >= lfg.maxPlayers;
  const isClosed = lfg.closed || isFull;

  const joinBtn = new ButtonBuilder()
    .setCustomId(`lfg_join_${lfg.id}`)
    .setLabel(isFull ? 'Jamoa To\'liq' : 'Qo\'shilish')
    .setEmoji('🎮')
    .setStyle(ButtonStyle.Success)
    .setDisabled(isClosed);

  const leaveBtn = new ButtonBuilder()
    .setCustomId(`lfg_leave_${lfg.id}`)
    .setLabel('Chiqish')
    .setEmoji('🚪')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(lfg.closed);

  const closeBtn = new ButtonBuilder()
    .setCustomId(`lfg_close_${lfg.id}`)
    .setLabel('Qidiruvni Yopish')
    .setEmoji('🔒')
    .setStyle(ButtonStyle.Danger)
    .setDisabled(lfg.closed);

  return new ActionRowBuilder().addComponents(joinBtn, leaveBtn, closeBtn);
}

/**
 * Yangi LFG yaratish
 */
function registerLfg(lfgData) {
  activeLfgs.set(lfgData.id, lfgData);
  return lfgData;
}

/**
 * LFG Tugmalari bosilganda ishlovchi funksiya
 */
async function handleLfgInteraction(interaction) {
  if (!interaction.isButton()) return false;
  const { customId, user, guild } = interaction;

  if (!customId.startsWith('lfg_')) return false;

  const parts = customId.split('_');
  const action = parts[1]; // join, leave, close
  const lfgId = parts.slice(2).join('_');

  const lfg = activeLfgs.get(lfgId);
  if (!lfg) {
    // Agar xotiradan o'chgan bo'lsa (masalan bot qayta ishga tushganda)
    await interaction.reply({
      content: '⚠️ Ushbu o\'yin qidiruvi sessiyasi yakunlangan yoki eskirgan.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  // 1. QO'SHILISH (JOIN)
  if (action === 'join') {
    if (lfg.closed || lfg.participants.length >= lfg.maxPlayers) {
      return interaction.reply({
        content: '⚠️ Jamoa allaqachon to\'lgan yoki qidiruv yopilgan!',
        flags: MessageFlags.Ephemeral
      });
    }

    if (lfg.participants.includes(user.id)) {
      return interaction.reply({
        content: '⚠️ Siz allaqachon ushbu jamoaga qo\'shilgansiz!',
        flags: MessageFlags.Ephemeral
      });
    }

    lfg.participants.push(user.id);

    // Ovozli kanalni aniqlash (belgilangan kanal yoki tashkilotchi o'tirgan xona)
    let targetVoiceChannel = null;
    if (lfg.voiceChannelId) {
      targetVoiceChannel = guild.channels.cache.get(lfg.voiceChannelId);
    }
    if (!targetVoiceChannel) {
      const hostMember = await guild.members.fetch(lfg.hostId).catch(() => null);
      if (hostMember?.voice?.channelId) {
        targetVoiceChannel = guild.channels.cache.get(hostMember.voice.channelId);
        if (targetVoiceChannel) {
          lfg.voiceChannelId = targetVoiceChannel.id;
        }
      }
    }

    // Agar qo'shilgan a'zo biror ovozli kanalda bo'lsa, uni tashkilotchi xonasiga tortib olish
    const member = interaction.member;
    let movedVoice = false;
    if (member?.voice?.channelId && targetVoiceChannel) {
      if (member.voice.channelId !== targetVoiceChannel.id) {
        await member.voice.setChannel(targetVoiceChannel).catch(err => {
          log.warn('[LFG VOICE KO\'CHIRISH XATOSI]:', err.message);
        });
        movedVoice = true;
      }
    }

    const isNowFull = lfg.participants.length >= lfg.maxPlayers;
    if (isNowFull) {
      lfg.closed = true;
    }

    const updatedEmbed = buildLfgEmbed(lfg, guild);
    const updatedButtons = buildLfgButtons(lfg);

    await interaction.update({
      embeds: [updatedEmbed],
      components: [updatedButtons]
    });

    // Agar jamoa to'lgan bo'lsa, chatga alohida xabar yuborish
    if (isNowFull) {
      const mentions = lfg.participants.map(uid => `<@${uid}>`).join(' ');
      const voiceText = lfg.voiceChannelId ? `<#${lfg.voiceChannelId}> ovozli kanaliga` : 'ovozli kanalga';
      await interaction.channel.send({
        content: `🎉 **${lfg.game} o'yini uchun jamoa to'liq yig'ildi!**\n${mentions} — Barchangiz ${voiceText} kiring va o'yinni boshlang! 🚀`
      }).catch(() => {});
    } else if (movedVoice && targetVoiceChannel) {
      await interaction.followUp({
        content: `🔊 Siz avtomatik tarzda tashkilotchi xonasiga (<#${targetVoiceChannel.id}>) ko'chirildingiz!`,
        flags: MessageFlags.Ephemeral
      }).catch(() => {});
    }

    return true;
  }

  // 2. CHIQISH (LEAVE)
  if (action === 'leave') {
    if (user.id === lfg.hostId) {
      return interaction.reply({
        content: '❌ Siz ushbu o\'yin tashkilotchisisiz. Agar qidiruvni bekor qilmoqchi bo\'lsangiz, **"Qidiruvni Yopish"** tugmasini bosing.',
        flags: MessageFlags.Ephemeral
      });
    }

    if (!lfg.participants.includes(user.id)) {
      return interaction.reply({
        content: '⚠️ Siz bu jamoa a\'zosi emassiz.',
        flags: MessageFlags.Ephemeral
      });
    }

    // A'zoni ro'yxatdan chiqarish
    lfg.participants = lfg.participants.filter(uid => uid !== user.id);
    // Agar to'lgan bo'lib yopilgan bo'lsa, kimdir chiqsa yana ochiladi
    if (lfg.closed && lfg.participants.length < lfg.maxPlayers) {
      lfg.closed = false;
    }

    const updatedEmbed = buildLfgEmbed(lfg, guild);
    const updatedButtons = buildLfgButtons(lfg);

    await interaction.update({
      embeds: [updatedEmbed],
      components: [updatedButtons]
    });

    return true;
  }

  // 3. YOPISH (CLOSE)
  if (action === 'close') {
    const isHost = user.id === lfg.hostId;
    const isStaff = interaction.member.permissions.has(PermissionFlagsBits.Administrator) ||
      interaction.member.permissions.has(PermissionFlagsBits.ManageMessages);

    if (!isHost && !isStaff) {
      return interaction.reply({
        content: '❌ Ushbu qidiruvni faqat tashkilotchi yoki server administratori yopa oladi!',
        flags: MessageFlags.Ephemeral
      });
    }

    lfg.closed = true;

    const closeEmbed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle(`🔒 O'yin Qidiruvi Yopildi: ${lfg.game}`)
      .setDescription(`Ushbu qidiruv <@${user.id}> tomonidan yopildi.\n*Ushbu xabar **5 soniyadan so'ng** avtomatik o'chiriladi...*`)
      .setTimestamp();

    await interaction.update({
      embeds: [closeEmbed],
      components: []
    });

    activeLfgs.delete(lfg.id);

    // 5 soniyadan so'ng xabarni avtomatik o'chirish
    setTimeout(async () => {
      try {
        await interaction.message.delete().catch(() => {});
      } catch (err) {
        // Ignorlash
      }
    }, 5000);

    return true;
  }

  return false;
}

module.exports = {
  registerLfg,
  buildLfgEmbed,
  buildLfgButtons,
  handleLfgInteraction
};
