const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const storage = require('../../config/storage');
const { getRealTimeActivity } = require('../../utils/activityTracker');

/**
 * Oddiy progress bar yasovchi funksiya
 */
function createProgressBar(current, total, barLength = 10) {
  if (total <= 0) return '`[🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩] 100%`';
  const percentage = Math.min(100, Math.max(0, Math.round((current / total) * 100)));
  const filledCount = Math.min(barLength, Math.round((current / total) * barLength));
  const emptyCount = Math.max(0, barLength - filledCount);

  const filledBar = '🟩'.repeat(filledCount);
  const emptyBar = '⬛'.repeat(emptyCount);

  return `[${filledBar}${emptyBar}] ${percentage}%`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('activity')
    .setDescription('Bugungi kunlik faolligingiz (ovozli vaqt va xabarlar soni) hamda rol holatini ko\'rish')
    .setDMPermission(false)
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Faolligini ko\'rmoqchi bo\'lgan foydalanuvchi (bo\'sh qoldirilsa o\'zingiz)')
        .setRequired(false)
    ),

  async execute(interaction) {
    const { guild, user } = interaction;
    const targetUser = interaction.options.getUser('user') || user;
    const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

    const settings = storage.getActiveRoleSettings(guild.id);
    const activity = getRealTimeActivity(guild.id, targetUser.id);

    const targetVoice = settings.voiceMinutes || 45;
    const targetMessages = settings.messageCount || 20;
    const roleId = settings.roleId;
    const role = roleId ? guild.roles.cache.get(roleId) : null;
    const hasRole = role ? (targetMember?.roles.cache.has(role.id) || false) : false;

    const voiceBar = createProgressBar(activity.voiceMinutes, targetVoice);
    const messageBar = createProgressBar(activity.messages, targetMessages);

    const modeNames = {
      voice_or_messages: '🎙️ Ovoz YOKI 💬 Chat (Birortasi yetarli)',
      voice_only: '🎙️ Faqat ovozli xonada o\'tirish',
      messages_only: '💬 Faqat chatda xabar yozish',
      voice_and_messages: '⚡ Ovoz VA Chat (Ikkalasi ham shart)'
    };

    let statusText = '';
    if (!settings.enabled || !role) {
      statusText = '⚠️ *Ushbu serverda kunlik faollik roli hozircha sozlanmagan.*';
    } else if (hasRole) {
      statusText = `🎉 **Sizda <@&${role.id}> roli mavjud!** (Faol a'zo)`;
    } else {
      const mode = settings.mode || 'voice_or_messages';
      if (mode === 'voice_only') {
        const left = Math.max(0, targetVoice - activity.voiceMinutes);
        statusText = `🟡 Rolni olish uchun yana **${left} daqiqa** ovozli xonada o'tirishingiz kerak.`;
      } else if (mode === 'messages_only') {
        const left = Math.max(0, targetMessages - activity.messages);
        statusText = `🟡 Rolni olish uchun yana **${left} ta** xabar yozishingiz kerak.`;
      } else if (mode === 'voice_and_messages') {
        const voiceLeft = Math.max(0, targetVoice - activity.voiceMinutes);
        const msgLeft = Math.max(0, targetMessages - activity.messages);
        statusText = `🟡 Rolni olish uchun yana **${voiceLeft} daqiqa ovoz** va **${msgLeft} ta xabar** kerak.`;
      } else {
        const voiceLeft = Math.max(0, targetVoice - activity.voiceMinutes);
        const msgLeft = Math.max(0, targetMessages - activity.messages);
        statusText = `🟡 Rolni olish uchun: Yana **${voiceLeft} daqiqa ovozda** o'tiring YOKI **${msgLeft} ta xabar** yozing.`;
      }
    }

    const embed = new EmbedBuilder()
      .setColor(hasRole ? 0x57F287 : 0x5865F2)
      .setAuthor({
        name: `${targetMember?.displayName || targetUser.username} — Kunlik Faollik`,
        iconURL: targetUser.displayAvatarURL({ dynamic: true })
      })
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
      .setDescription(
        `👤 **Foydalanuvchi:** <@${targetUser.id}>\n` +
        `🎖️ **Faollik Roli:** ${role ? `<@&${role.id}>` : '*Belgilanmagan*'}\n` +
        `📊 **Holat:** ${statusText}\n\n` +
        `🎯 **Talab tartibi:** ${modeNames[settings.mode] || modeNames.voice_or_messages}`
      )
      .addFields(
        {
          name: `🎙️ Ovozli Xona Vaqti (${activity.voiceMinutes} / ${targetVoice} daqiqa)`,
          value: `${voiceBar}`,
          inline: false
        },
        {
          name: `💬 Chatdagi Xabarlar (${activity.messages} / ${targetMessages} ta)`,
          value: `${messageBar}`,
          inline: false
        }
      )
      .setFooter({ text: 'Cleva • Ertasiga kirmasangiz rol avtomatik olib tashlanadi' })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }
};
