const { EmbedBuilder, AuditLogEvent, PermissionFlagsBits } = require('discord.js');
const storage = require('../config/storage');

async function sendLog(guild, embed, type = 'general', files = []) {
  try {
    if (!guild) return;
    const settings = storage.getGuildSettings(guild.id);

    // Kategoriya ichidagi maxsus kanalni aniqlash
    let channelId = null;
    if (settings.logChannels && settings.logChannels[type]) {
      channelId = settings.logChannels[type];
    } else if (settings.logChannelId) {
      channelId = settings.logChannelId;
    }

    if (!channelId) return;

    // 1. Avval joriy serverdan, topilmasa boshqa serverdagi kanallar ichidan izlash
    let channel = guild.channels.cache.get(channelId);
    if (!channel && guild.channels.fetch) {
      channel = await guild.channels.fetch(channelId).catch(() => null);
    }
    if (!channel && guild.client && guild.client.channels) {
      channel = guild.client.channels.cache.get(channelId) ||
        await guild.client.channels.fetch(channelId).catch(() => null);
    }

    if (!channel || !channel.isTextBased()) return;

    // 2. Agar log boshqa serverdagi kanalga yuborilayotgan bo'lsa, xabar pastiga server nomini ilova qilish
    if (channel.guild && channel.guild.id !== guild.id) {
      const currentFooter = embed.data?.footer?.text || '';
      embed.setFooter({
        text: currentFooter ? `${currentFooter} • 🌐 Server: ${guild.name}` : `🌐 Server: ${guild.name}`
      });
    }

    const payload = { embeds: [embed] };
    if (files && files.length > 0) {
      payload.files = files;
    }

    await channel.send(payload).catch(err => {
      console.error(`Log xabari yuborishda xatolik (${guild.name} -> ${channel.guild?.name || 'Boshqa server'} / ${type}):`, err.message);
    });
  } catch (error) {
    console.error('Logger xatosi:', error);
  }
}

module.exports = {
  sendLog,

  // 1. XABARLAR LOGLARI (type: 'messages')
  async logMessageDelete(message) {
    if (!message.guild) return;

    let executorText = '👤 Foydalanuvchining o\'zi (yoki audit logda qayd etilmagan)';
    let reasonText = null;

    try {
      // Discord audit logga yozilishi uchun biroz kutish kerak (800ms)
      await new Promise(resolve => setTimeout(resolve, 800));

      const me = message.guild.members.me || await message.guild.members.fetchMe().catch(() => null);
      if (me && me.permissions.has(PermissionFlagsBits.ViewAuditLog)) {
        // 1. MessageDelete audit logini tekshirish
        const logs = await message.guild.fetchAuditLogs({
          limit: 5,
          type: AuditLogEvent.MessageDelete
        }).catch(() => null);

        if (logs && logs.entries.size > 0) {
          const now = Date.now();
          const entry = logs.entries.find(e => {
            const timeDiff = now - e.createdTimestamp;
            const targetMatches = !e.target || !message.author || e.target.id === message.author.id;
            const channelMatches = !e.extra?.channel || e.extra.channel.id === message.channelId;
            return timeDiff < 10000 && targetMatches && channelMatches;
          });

          if (entry && entry.executor) {
            reasonText = entry.reason;
            if (message.author && entry.executor.id === message.author.id) {
              executorText = `👤 **${entry.executor.tag}** (<@${entry.executor.id}>) — *O'z xabarini o'zi o'chirdi*`;
            } else if (entry.executor.bot) {
              executorText = `🤖 **${entry.executor.tag}** (<@${entry.executor.id}>) — *Bot tomonidan o'chirildi*`;
            } else {
              executorText = `🛡️ **${entry.executor.tag}** (<@${entry.executor.id}>) — *Moderator/Admin tomonidan o'chirildi*`;
            }
          }
        }

        // 2. Agar MessageDelete da topilmasa, AutoMod ni tekshirish
        if (executorText.includes('o\'zi')) {
          const autoModLogs = await message.guild.fetchAuditLogs({
            limit: 5,
            type: AuditLogEvent.AutoModerationBlockMessage
          }).catch(() => null);

          if (autoModLogs && autoModLogs.entries.size > 0) {
            const now = Date.now();
            const autoEntry = autoModLogs.entries.find(e => {
              const timeDiff = now - e.createdTimestamp;
              const targetMatches = !e.target || !message.author || e.target.id === message.author.id;
              return timeDiff < 10000 && targetMatches;
            });

            if (autoEntry) {
              const ruleName = autoEntry.extra?.ruleName || autoEntry.reason || 'AutoMod qoidasi';
              executorText = `🛡️ **Discord AutoMod** — *Qoida: "${ruleName}"*`;
            }
          }
        }
      }
    } catch (err) {
      console.error('Audit log tekshirishda xato:', err.message);
    }

    const embed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle('🗑️ Xabar O\'chirildi')
      .setDescription(
        `**Xabar egasi (Muallif):** ${message.author ? `${message.author.tag} (<@${message.author.id}>)` : 'Noma\'lum'}\n` +
        `**Kim o'chirdi (O'chiruvchi):** ${executorText}\n` +
        `**Kanal:** <#${message.channelId}>\n` +
        (reasonText ? `**Sabab:** ${reasonText}\n` : '') +
        `\n**Xabar matni:**\n${message.content ? message.content.slice(0, 1800) : '*(Matn yo\'q yoki faqat rasm/GIF/fayl bo\'lgan)*'}`
      )
      .setFooter({ text: `Foydalanuvchi ID: ${message.author?.id || 'Noma\'lum'}` })
      .setTimestamp();

    if (message.attachments?.size > 0) {
      const fileUrls = message.attachments.map(a => a.url).join('\n');
      embed.addFields({ name: 'Biriktirilgan fayllar', value: fileUrls.slice(0, 1024) });
    }

    await sendLog(message.guild, embed, 'messages');
  },

  async logMessageUpdate(oldMessage, newMessage) {
    if (!newMessage.guild || newMessage.author?.bot) return;
    if (oldMessage.content === newMessage.content) return;

    const embed = new EmbedBuilder()
      .setColor(0xFEE75C)
      .setTitle('✏️ Xabar Tahrirlandi')
      .setDescription(`**Muallif:** ${newMessage.author.tag} (<@${newMessage.author.id}>)\n**Kanal:** <#${newMessage.channelId}>\n[Xabarga o'tish](${newMessage.url})`)
      .addFields(
        { name: 'Eski matn:', value: oldMessage.content ? oldMessage.content.slice(0, 1024) : '*(Bo\'sh)*' },
        { name: 'Yangi matn:', value: newMessage.content ? newMessage.content.slice(0, 1024) : '*(Bo\'sh)*' }
      )
      .setFooter({ text: `Foydalanuvchi ID: ${newMessage.author.id}` })
      .setTimestamp();

    await sendLog(newMessage.guild, embed, 'messages');
  },

  // 2. A'ZOLAR LOGLARI (type: 'members')
  async logMemberJoin(member) {
    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('📥 Yangi A\'zo Qo\'shildi')
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
      .setDescription(`${member.user.tag} (<@${member.user.id}>) serverga kirdi.`)
      .addFields(
        { name: 'Hisob ochilgan sana', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
        { name: 'Serverdagi a\'zolar soni', value: `${member.guild.memberCount}`, inline: true }
      )
      .setFooter({ text: `ID: ${member.id}` })
      .setTimestamp();

    await sendLog(member.guild, embed, 'members');
  },

  async logMemberLeave(member) {
    const embed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle('📤 A\'zo Serverdan Chiqdi')
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
      .setDescription(`${member.user.tag} (<@${member.user.id}>) serverni tark etdi.`)
      .addFields(
        { name: 'Qolgan a\'zolar soni', value: `${member.guild.memberCount}`, inline: true }
      )
      .setFooter({ text: `ID: ${member.id}` })
      .setTimestamp();

    await sendLog(member.guild, embed, 'members');
  },

  async logMemberUpdate(oldMember, newMember) {
    const addedRoles = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
    const removedRoles = oldMember.roles.cache.filter(r => !newMember.roles.cache.has(r.id));

    if (addedRoles.size === 0 && removedRoles.size === 0 && oldMember.nickname === newMember.nickname) return;

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('👤 A\'zo Profili O\'zgardi')
      .setThumbnail(newMember.user.displayAvatarURL({ dynamic: true, size: 256 }))
      .setDescription(`**Foydalanuvchi:** ${newMember.user.tag} (<@${newMember.id}>)`)
      .setTimestamp()
      .setFooter({ text: `ID: ${newMember.id}` });

    if (addedRoles.size > 0) {
      embed.addFields({
        name: '➕ Berilgan rollar',
        value: addedRoles.map(r => `<@&${r.id}>`).join(', ')
      });
    }

    if (removedRoles.size > 0) {
      embed.addFields({
        name: '➖ Olib tashlangan rollar',
        value: removedRoles.map(r => `<@&${r.id}>`).join(', ')
      });
    }

    if (oldMember.nickname !== newMember.nickname) {
      embed.addFields({
        name: '📛 Taxallus (Nickname) o\'zgardi',
        value: `**Eski:** ${oldMember.nickname || 'Asl ismi'}\n**Yangi:** ${newMember.nickname || 'Asl ismi'}`
      });
    }

    await sendLog(newMember.guild, embed, 'members');
  },

  // 3. MODERATSIYA LOGLARI (type: 'moderation')
  async logBanAdd(ban) {
    const embed = new EmbedBuilder()
      .setColor(0x992D22)
      .setTitle('🔨 Foydalanuvchi Ban Qilindi')
      .setThumbnail(ban.user.displayAvatarURL({ dynamic: true, size: 256 }))
      .setDescription(`${ban.user.tag} (<@${ban.user.id}>) serverdan chetlatildi (ban).`)
      .addFields({ name: 'Sabab', value: ban.reason || 'Sabab ko\'rsatilmagan' })
      .setFooter({ text: `ID: ${ban.user.id}` })
      .setTimestamp();

    await sendLog(ban.guild, embed, 'moderation');
  },

  async logBanRemove(ban) {
    const embed = new EmbedBuilder()
      .setColor(0x2ECC71)
      .setTitle('🔓 Foydalanuvchi Bandan Chiqarildi')
      .setThumbnail(ban.user.displayAvatarURL({ dynamic: true, size: 256 }))
      .setDescription(`${ban.user.tag} (<@${ban.user.id}>) ning bandan chiqarildi.`)
      .setFooter({ text: `ID: ${ban.user.id}` })
      .setTimestamp();

    await sendLog(ban.guild, embed, 'moderation');
  },

  async logModAction(guild, actionName, moderator, targetUser, reason = null, extra = null) {
    const embed = new EmbedBuilder()
      .setColor(0xEB459E)
      .setTitle(`🛡️ Moderatsiya: ${actionName}`)
      .setDescription(`**Moderator:** ${moderator.tag} (<@${moderator.id}>)\n**Nishon:** ${targetUser.tag || targetUser.name} (<@${targetUser.id}>)`)
      .setTimestamp()
      .setFooter({ text: `Moderator ID: ${moderator.id}` });

    if (reason) {
      embed.addFields({ name: 'Sabab', value: reason });
    }
    if (extra) {
      embed.addFields({ name: 'Qo\'shimcha', value: extra });
    }

    await sendLog(guild, embed, 'moderation');
  },

  async logAntiLink(message, linkText) {
    const embed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle('🚫 Reklama / Havola To\'xtatildi (Anti-Link)')
      .setDescription(`**Qoidabuzar:** ${message.author.tag} (<@${message.author.id}>)\n**Kanal:** <#${message.channel.id}>`)
      .addFields(
        { name: 'O\'chirilgan havola/matn', value: linkText ? linkText.slice(0, 1024) : 'Havola aniqlandi' }
      )
      .setFooter({ text: `Foydalanuvchi ID: ${message.author.id}` })
      .setTimestamp();

    await sendLog(message.guild, embed, 'moderation');
  },

  // 4. OVOZLI KANAL LOGLARI (type: 'voice')
  async logVoiceStateUpdate(oldState, newState) {
    const member = newState.member || oldState.member;
    if (!member || member.user.bot) return;

    let desc = '';
    let color = 0x5865F2;

    if (!oldState.channelId && newState.channelId) {
      desc = `🔊 ${member.user.tag} (<@${member.id}>) **<#${newState.channelId}>** ovozli kanaliga kirdi.`;
      color = 0x57F287;
    } else if (oldState.channelId && !newState.channelId) {
      desc = `🔇 ${member.user.tag} (<@${member.id}>) **<#${oldState.channelId}>** ovozli kanalidan chiqdi.`;
      color = 0xED4245;
    } else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
      desc = `🔀 ${member.user.tag} (<@${member.id}>) ovozli kanalni o'zgartirdi:\n**Eski:** <#${oldState.channelId}>\n**Yangi:** <#${newState.channelId}>`;
      color = 0xFEE75C;
    } else {
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle('🎙️ Ovozli Kanal Harakati')
      .setDescription(desc)
      .setFooter({ text: `ID: ${member.id}` })
      .setTimestamp();

    await sendLog(member.guild, embed, 'voice');
  },

  // 5. TICKET LOGLARI (type: 'tickets')
  async logTicketAction(guild, embed, files = []) {
    await sendLog(guild, embed, 'tickets', files);
  },

  // 6. TEKSHIRUV LOGLARI (type: 'members')
  async logMemberVerify(member, role, type = 'button') {
    if (!member || !member.guild) return;
    const typeLabel = type === 'math' ? '🧮 Matematik misol' : type === 'code' ? '🔢 4 xonali kod' : '🔘 Oddiy tugma';
    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('✅ A\'zo Tekshiruvdan O\'tdi')
      .setDescription(
        `**Foydalanuvchi:** ${member.user.tag} (${member})\n` +
        `**Biriktirilgan rol:** <@&${role.id}>\n` +
        `**Tekshiruv usuli:** ${typeLabel}\n` +
        `**Vaqt:** <t:${Math.floor(Date.now() / 1000)}:R>`
      )
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: `Foydalanuvchi ID: ${member.id}` })
      .setTimestamp();

    await sendLog(member.guild, embed, 'members');
  }
};
