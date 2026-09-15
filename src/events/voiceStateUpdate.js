const { ChannelType, PermissionFlagsBits } = require('discord.js');
const storage = require('../config/storage');
const logger = require('../utils/logger');
const { sendRoomControlPanel, activeTempChannels, tempChannelOwners } = require('../utils/tempVoiceManager');
const { handleVoiceUpdate } = require('../utils/activityTracker');
const { updateGuildStats } = require('../utils/statsUpdater');
const log = require('../utils/log');

module.exports = {
  name: 'voiceStateUpdate',
  async execute(oldState, newState) {
    // 1. Ovozli loglarga yozish
    await logger.logVoiceStateUpdate(oldState, newState).catch(() => {});

    const guild = newState.guild || oldState.guild;
    if (!guild) return;

    // 1.1. Kunlik faollik vaqtini hisoblash (Active Role)
    await handleVoiceUpdate(oldState, newState).catch(() => {});

    const settings = storage.getGuildSettings(guild.id);
    if (!settings.tempVoice || !settings.tempVoice.enabled) return;

    const { channelId: joinToCreateId, categoryId } = settings.tempVoice;

    // 2. FOYDALANUVCHI "➕ Xona Yaratish" GA KIRGANDA
    if (newState.channelId && newState.channelId === joinToCreateId) {
      const member = newState.member;
      if (!member) return;

      try {
        const cleanName = member.displayName || member.user.username;
        const tempChannel = await guild.channels.create({
          name: `🔊・${cleanName} Chat`,
          type: ChannelType.GuildVoice,
          parent: categoryId || undefined,
          permissionOverwrites: [
            {
              id: member.id,
              allow: [
                PermissionFlagsBits.ManageChannels,
                PermissionFlagsBits.MoveMembers,
                PermissionFlagsBits.MuteMembers,
                PermissionFlagsBits.DeafenMembers,
                PermissionFlagsBits.Connect,
                PermissionFlagsBits.Speak
              ]
            }
          ]
        });

        activeTempChannels.add(tempChannel.id);
        tempChannelOwners.set(tempChannel.id, member.id);

        // Foydalanuvchini yangi ochilgan xonasiga ko'chirish
        await member.voice.setChannel(tempChannel).catch(async () => {
          // Agar foydalanuvchi ko'chishdan oldin chiqib ketgan bo'lsa, xonani tozalash
          if (tempChannel.members.size === 0) {
            await tempChannel.delete().catch(() => {});
            activeTempChannels.delete(tempChannel.id);
            tempChannelOwners.delete(tempChannel.id);
          }
        });

        // 3. Xona ichiga Boshqaruv Panelini yuborish
        await sendRoomControlPanel(tempChannel, member);
      } catch (err) {
        log.error('[TEMP-VOICE YARATISH XATOSI]:', err);
      }
    }

    // 4. FOYDALANUVCHI XONADAN CHIQIB KETGANDA (BO'SHAGAN XONANI O'CHIRISH)
    if (oldState.channelId && oldState.channelId !== joinToCreateId) {
      const oldChannel = oldState.channel;
      if (oldChannel) {
        const isTracked = activeTempChannels.has(oldChannel.id);
        const isInTempCategory = categoryId && oldChannel.parentId === categoryId && oldChannel.id !== joinToCreateId;

        if ((isTracked || isInTempCategory) && oldChannel.members.size === 0) {
          try {
            await oldChannel.delete().catch(() => {});
            activeTempChannels.delete(oldChannel.id);
            tempChannelOwners.delete(oldChannel.id);
          } catch (err) {
            // Ignorlash
          }
        }
      }
    }

    // 5. Ovozli xonalar statistikasi hisoblagichini yangilash
    if (oldState.channelId !== newState.channelId) {
      updateGuildStats(guild);
    }
  }
};
