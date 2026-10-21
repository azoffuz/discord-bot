const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder, MessageFlags } = require('discord.js');
const storage = require('../../config/storage');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set-level')
    .setDescription('Chatda tajriba to\'plash (Level & XP) tizimini yoqish yoki o\'chirish')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option
        .setName('status')
        .setDescription('Tizim holatini tanlang (bo\'sh qoldirilsa - joriy sozlamalar ko\'rsatiladi)')
        .setRequired(false)
        .addChoices(
          { name: '✅ Yoqish (A\'zolar chatda yozib XP to\'playdi)', value: 'enable' },
          { name: '❌ O\'chirish (XP to\'planishi to\'xtatiladi)', value: 'disable' }
        )
    )
    .addChannelOption(option =>
      option
        .setName('channel')
        .setDescription('Level oshganda tabriklash xabarlari yuboriladigan kanal (Ixtiyoriy)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option
        .setName('voice_xp')
        .setDescription('Ovozli xonada suhbatlashgani uchun ham XP berilsinmi (daqiqasiga 10 XP)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('announce')
        .setDescription('Daraja ko\'tarilganda e\'lon qayerga yuborilsin')
        .setRequired(false)
        .addChoices(
          { name: '📢 Tabriklash kanaliga (sozlanmagan bo\'lsa - yozilgan chatga)', value: 'auto' },
          { name: '✉️ A\'zoning shaxsiy xabariga (DM)', value: 'dm' },
          { name: '🔕 E\'lon qilinmasin', value: 'off' }
        )
    )
    .addStringOption(option =>
      option
        .setName('message')
        .setDescription('E\'lon matni: {user} {username} {level} {server} {role}. "reset" - standart matn')
        .setMaxLength(1000)
        .setRequired(false)
    )
    .addIntegerOption(option =>
      option
        .setName('announce_every')
        .setDescription('Har nechta darajada e\'lon qilinsin (1 = har darajada; mukofot roli doim e\'lon qilinadi)')
        .setMinValue(1)
        .setMaxValue(100)
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

    const statusChoice = interaction.options.getString('status');
    const targetChannel = interaction.options.getChannel('channel');
    const voiceXp = interaction.options.getBoolean('voice_xp');
    const announceMode = interaction.options.getString('announce');
    const announceMessage = interaction.options.getString('message');
    const announceEvery = interaction.options.getInteger('announce_every');
    const guild = interaction.guild;
    const currentLeveling = storage.getGuildSettings(guild.id).leveling;

    const announceChanged = announceMode !== null || announceMessage !== null || announceEvery !== null;
    const nothingChanged = !statusChoice && !targetChannel && voiceXp === null && !announceChanged;

    const announce = { ...currentLeveling.announce };
    if (announceMode) announce.mode = announceMode;
    if (announceMessage !== null) {
      announce.message = announceMessage.trim().toLowerCase() === 'reset' ? null : announceMessage.trim();
    }
    if (announceEvery !== null) announce.every = announceEvery;

    if (!nothingChanged) {
      storage.updateGuildSettings(guild.id, {
        leveling: {
          ...currentLeveling,
          enabled: statusChoice ? statusChoice === 'enable' : currentLeveling.enabled,
          // O'chirilganda ham kanal saqlanadi - qayta yoqqanda qayta sozlash shart emas
          channelId: targetChannel ? targetChannel.id : currentLeveling.channelId,
          voiceXp: voiceXp ?? currentLeveling.voiceXp,
          announce
        }
      });
    }

    const leveling = storage.getGuildSettings(guild.id).leveling;

    const announceWhere = {
      auto: leveling.channelId ? `<#${leveling.channelId}>` : '*Xabar yozilgan chatning o\'zida*',
      dm: '✉️ *A\'zoning shaxsiy xabarida (DM)*',
      off: '🔕 *E\'lon qilinmaydi*'
    }[leveling.announce.mode] || '*Xabar yozilgan chatning o\'zida*';

    const details =
      `📢 **Daraja e'loni:** ${announceWhere}` +
      (leveling.announce.every > 1 ? ` • har **${leveling.announce.every}** darajada` : '') + '\n' +
      `📝 **E'lon matni:** ${leveling.announce.message ? `\`${leveling.announce.message.slice(0, 200)}\`` : '*Standart*'}\n` +
      `🎙️ **Ovozli xona XP si:** ${leveling.voiceXp !== false ? '✅ Yoqilgan (daqiqasiga 10 XP)' : '❌ O\'chirilgan'}\n` +
      '💡 *XP chatdagi xabarlar (daqiqada bir marta 15-25 XP)' +
      (leveling.voiceXp !== false ? ' va ovozli xonada suhbat uchun beriladi (AFK, ovozi o\'chirilgan yoki yolg\'iz o\'tirganlarga berilmaydi).*' : ' uchun beriladi.*') +
      '\n🎁 *Rol mukofotlari:* `/set-level-rewards` • ⚡ *XP ko\'paytiruvchilari:* `/set-level-multiplier`';

    const embed = new EmbedBuilder()
      .setColor(leveling.enabled ? 0x57F287 : 0xED4245)
      .setTitle(nothingChanged
        ? '🏆 Level & XP Tizimi Sozlamalari'
        : (leveling.enabled ? '🏆 Level & XP Tizimi Yoqildi!' : '🏆 Level & XP Tizimi O\'chirildi'))
      .setDescription(
        leveling.enabled
          ? '✅ **Faollik uchun daraja (Level/XP) to\'plash tizimi ishlamoqda.**\n\n' + details
          : '❌ **Level & XP tizimi o\'chirilgan.** Foydalanuvchilar XP to\'plamaydi.\n\n' + details
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed], allowedMentions: { parse: [] } });
  }
};
