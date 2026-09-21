const { PermissionFlagsBits } = require('discord.js');
const storage = require('../config/storage');
const logger = require('../utils/logger');
const { containsBadWord } = require('../utils/badWordsFilter');

module.exports = {
  name: 'messageUpdate',
  async execute(oldMessage, newMessage) {
    await logger.logMessageUpdate(oldMessage, newMessage);

    if (!newMessage.guild || newMessage.author?.bot) return;

    const guild = newMessage.guild;
    const settings = storage.getGuildSettings(guild.id);

    // TAQIQLANGAN HAQORATLI SO'ZLAR TEKSHIRUVI (AutoMod - Bad Words on edit)
    if (settings.badWordsEnabled !== false && Array.isArray(settings.badWords) && settings.badWords.length > 0) {
      const member = newMessage.member;
      const isOwner = process.env.OWNER_ID && newMessage.author.id === process.env.OWNER_ID.trim();
      const isStaff = member && (
        member.permissions.has(PermissionFlagsBits.Administrator) ||
        member.permissions.has(PermissionFlagsBits.ManageMessages) ||
        member.permissions.has(PermissionFlagsBits.ManageGuild)
      );

      if (!isOwner && !isStaff && newMessage.content) {
        const badWordCheck = containsBadWord(newMessage.content, settings.badWords);
        if (badWordCheck.hasBadWord) {
          try {
            await newMessage.delete().catch(() => {});

            const warnMsg = await newMessage.channel.send({
              content: `⚠️ ${newMessage.author}, iltimos, haqoratli so'z ishlatmang! Serverda odob-axloq qoidalariga rioya qiling.`,
              allowedMentions: { parse: [] }
            }).catch(() => null);

            if (warnMsg) {
              setTimeout(() => {
                warnMsg.delete().catch(() => {});
              }, 5000);
            }

            await logger.logModAction(
              guild,
              'Haqoratli So\'z To\'xtatildi (Tahrirlangan xabar)',
              guild.client.user,
              newMessage.author,
              `Taqiqlangan so'z ishlatildi: ||${badWordCheck.matchedWord}||`,
              `Kanal: <#${newMessage.channel.id}>\nTahrirlangan xabar: ||${newMessage.content.slice(0, 500)}||`
            ).catch(() => {});
          } catch (err) {
            console.error('Bad words tekshirishda xatolik (messageUpdate):', err.message);
          }
        }
      }
    }
  }
};
