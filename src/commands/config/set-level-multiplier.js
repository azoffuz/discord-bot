const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder, MessageFlags } = require('discord.js');
const storage = require('../../config/storage');
const { MAX_MULTIPLIER } = require('../../utils/levelManager');

const formatMult = m => (m === 0 ? '🚫 XP yo\'q' : `×${m}`);

function describeEvent(event) {
  if (!event) return null;
  if (event.endsAt && event.endsAt <= Date.now()) return null;
  const until = event.endsAt ? ` — <t:${Math.floor(event.endsAt / 1000)}:R> tugaydi` : ' — o\'chirilguncha';
  return `🔥 **×${event.multiplier}**${until}`;
}

const addMultiplierOption = (sub, min = 0) => sub.addNumberOption(option =>
  option
    .setName('multiplier')
    .setDescription(`Ko'paytiruvchi: ${min === 0 ? '0 = XP berilmaydi, ' : ''}1 = odatiy, 2 = ikki baravar (maks. ${MAX_MULTIPLIER})`)
    .setMinValue(min)
    .setMaxValue(MAX_MULTIPLIER)
    .setRequired(true));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set-level-multiplier')
    .setDescription('Rol, kanal yoki tadbir uchun XP ko\'paytiruvchisi (0 = XP berilmaydi)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)
    .addSubcommand(sub => addMultiplierOption(sub
      .setName('role')
      .setDescription('Rolga XP ko\'paytiruvchisi (masalan boosterlarga ×1.5, jazolanganlarga 0)')
      .addRoleOption(option => option.setName('role').setDescription('Rol').setRequired(true))))
    .addSubcommand(sub => addMultiplierOption(sub
      .setName('channel')
      .setDescription('Kanal yoki kategoriyaga XP ko\'paytiruvchisi (masalan spam/bot kanaliga 0)')
      .addChannelOption(option =>
        option
          .setName('channel')
          .setDescription('Matnli/ovozli kanal yoki butun kategoriya')
          .addChannelTypes(
            ChannelType.GuildText,
            ChannelType.GuildVoice,
            ChannelType.GuildStageVoice,
            ChannelType.GuildForum,
            ChannelType.GuildAnnouncement,
            ChannelType.GuildCategory
          )
          .setRequired(true))))
    .addSubcommand(sub => addMultiplierOption(sub
      .setName('event')
      .setDescription('Butun server uchun XP tadbiri (masalan dam olish kunlari ×2)'), 1)
      .addIntegerOption(option =>
        option
          .setName('hours')
          .setDescription('Necha soat davom etadi (bo\'sh qoldirilsa - o\'chirilguncha)')
          .setMinValue(1)
          .setMaxValue(720)
          .setRequired(false)))
    .addSubcommand(sub => sub
      .setName('event-stop')
      .setDescription('XP tadbirini to\'xtatish'))
    .addSubcommand(sub => sub
      .setName('remove')
      .setDescription('Rol yoki kanal ko\'paytiruvchisini olib tashlash')
      .addRoleOption(option => option.setName('role').setDescription('Rol').setRequired(false))
      .addChannelOption(option => option.setName('channel').setDescription('Kanal yoki kategoriya').setRequired(false)))
    .addSubcommand(sub => sub
      .setName('list')
      .setDescription('Barcha XP ko\'paytiruvchilarini ko\'rish')),

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

    const guild = interaction.guild;
    const sub = interaction.options.getSubcommand();
    const current = storage.getGuildSettings(guild.id).leveling.multipliers;
    const multipliers = {
      roles: { ...current.roles },
      channels: { ...current.channels },
      event: current.event
    };
    const save = () => storage.updateLevelingSettings(guild.id, { multipliers });

    if (sub === 'role' || sub === 'channel') {
      const target = sub === 'role' ? interaction.options.getRole('role') : interaction.options.getChannel('channel');
      const value = interaction.options.getNumber('multiplier');
      const bucket = sub === 'role' ? multipliers.roles : multipliers.channels;

      if (sub === 'role' && target.id === guild.id) {
        return interaction.reply({
          content: '❌ `@everyone` uchun ko\'paytiruvchi qo\'yib bo\'lmaydi - butun server uchun `/set-level-multiplier event` dan foydalaning.',
          flags: MessageFlags.Ephemeral
        });
      }

      // ×1 - odatiy holat, saqlashning hojati yo'q
      if (value === 1) delete bucket[target.id];
      else bucket[target.id] = value;
      save();

      const hint = sub === 'channel' && target.type === ChannelType.GuildCategory
        ? '\n💡 *Kategoriyadagi barcha kanallarga (o\'z sozlamasi bo\'lmasa) ta\'sir qiladi.*'
        : '';
      return interaction.reply({
        content: `✅ ${target} uchun XP: **${value === 1 ? 'odatiy (×1)' : formatMult(value)}**${hint}`,
        allowedMentions: { parse: [] }
      });
    }

    if (sub === 'event') {
      const value = interaction.options.getNumber('multiplier');
      const hours = interaction.options.getInteger('hours');
      multipliers.event = { multiplier: value, endsAt: hours ? Date.now() + hours * 3600000 : null };
      save();
      return interaction.reply({ content: `✅ XP tadbiri boshlandi: ${describeEvent(multipliers.event)}` });
    }

    if (sub === 'event-stop') {
      const wasActive = Boolean(describeEvent(multipliers.event));
      multipliers.event = null;
      save();
      return interaction.reply({
        content: wasActive ? '✅ XP tadbiri to\'xtatildi.' : 'ℹ️ Faol XP tadbiri yo\'q edi.'
      });
    }

    if (sub === 'remove') {
      const role = interaction.options.getRole('role');
      const channel = interaction.options.getChannel('channel');
      if (!role && !channel) {
        return interaction.reply({
          content: '❌ `role` yoki `channel` dan kamida bittasini kiriting.',
          flags: MessageFlags.Ephemeral
        });
      }

      const removed = [];
      if (role && multipliers.roles[role.id] !== undefined) {
        delete multipliers.roles[role.id];
        removed.push(`${role}`);
      }
      if (channel && multipliers.channels[channel.id] !== undefined) {
        delete multipliers.channels[channel.id];
        removed.push(`${channel}`);
      }
      if (removed.length === 0) {
        return interaction.reply({
          content: 'ℹ️ Bunday ko\'paytiruvchi topilmadi. Ro\'yxat: `/set-level-multiplier list`',
          flags: MessageFlags.Ephemeral
        });
      }
      save();
      return interaction.reply({
        content: `✅ Olib tashlandi: ${removed.join(', ')} (endi odatiy ×1).`,
        allowedMentions: { parse: [] }
      });
    }

    // list
    const roleLines = Object.entries(multipliers.roles).map(([id, m]) => `<@&${id}> — **${formatMult(m)}**`);
    const channelLines = Object.entries(multipliers.channels).map(([id, m]) => `<#${id}> — **${formatMult(m)}**`);

    const embed = new EmbedBuilder()
      .setColor(0xFEE75C)
      .setTitle('⚡ XP Ko\'paytiruvchilari')
      .addFields(
        { name: '🎭 Rollar', value: roleLines.join('\n').slice(0, 1024) || '*Yo\'q*', inline: false },
        { name: '💬 Kanallar / Kategoriyalar', value: channelLines.join('\n').slice(0, 1024) || '*Yo\'q*', inline: false },
        { name: '🔥 Server tadbiri', value: describeEvent(multipliers.event) || '*Faol emas*', inline: false }
      )
      .setFooter({ text: `Bir nechta roldan eng yuqorisi olinadi (0 li rol doim ustun). Jami: rol × kanal × tadbir, maks. ×${MAX_MULTIPLIER}` })
      .setTimestamp();

    return interaction.reply({ embeds: [embed], allowedMentions: { parse: [] } });
  }
};
