const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const storage = require('../../config/storage');
const { getMemberFilter } = require('../../utils/levelManager');

const PAGE_SIZE = 10;
// Sahifalash tugmalari shuncha vaqt faol bo'ladi
const PAGER_TIMEOUT_MS = 3 * 60 * 1000;

const PERIOD_LABELS = {
  all: 'Barcha vaqt',
  month: 'Shu oy',
  week: 'Shu hafta'
};

const TYPE_LABELS = {
  xp: '✨ XP',
  messages: '💬 Xabarlar',
  voice: '🎙️ Ovozli xona'
};

function formatValue(entry, type) {
  if (type === 'messages') return `${entry.value} ta xabar`;
  if (type === 'voice') {
    const h = Math.floor(entry.value / 60);
    return h > 0 ? `${h} soat ${entry.value % 60} daq` : `${entry.value} daq`;
  }
  return `${entry.value} XP`;
}

function buildPage(guild, list, page, period, type) {
  const medals = ['🥇', '🥈', '🥉'];
  const pageCount = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const start = page * PAGE_SIZE;

  const description = list
    .slice(start, start + PAGE_SIZE)
    .map((entry, i) => {
      const position = start + i;
      const medal = medals[position] || `\`#${position + 1}\``;
      return `${medal} <@${entry.id}> — **${formatValue(entry, type)}** • *${entry.level}-daraja*`;
    })
    .join('\n\n');

  const embed = new EmbedBuilder()
    .setColor(0xFEE75C)
    .setTitle(`🏆 ${guild.name} — Reyting (${TYPE_LABELS[type]} • ${PERIOD_LABELS[period]})`)
    .setDescription(description)
    .setFooter({ text: `Sahifa ${page + 1}/${pageCount} • Jami: ${list.length} a'zo • Cleva Leaderboard` })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('leaderboard_prev')
      .setEmoji('◀️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId('leaderboard_next')
      .setEmoji('▶️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= pageCount - 1)
  );

  return { embeds: [embed], components: pageCount > 1 ? [row] : [] };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Serverdagi eng faol a\'zolar reytingi')
    .addStringOption(option =>
      option
        .setName('period')
        .setDescription('Qaysi davr bo\'yicha (standart: barcha vaqt)')
        .setRequired(false)
        .addChoices(
          { name: '📅 Barcha vaqt', value: 'all' },
          { name: '🗓️ Shu oy', value: 'month' },
          { name: '📆 Shu hafta', value: 'week' }
        )
    )
    .addStringOption(option =>
      option
        .setName('type')
        .setDescription('Nima bo\'yicha saralash (standart: XP)')
        .setRequired(false)
        .addChoices(
          { name: TYPE_LABELS.xp, value: 'xp' },
          { name: TYPE_LABELS.messages, value: 'messages' },
          { name: TYPE_LABELS.voice, value: 'voice' }
        )
    ),

  async execute(interaction) {
    const guild = interaction.guild;
    const period = interaction.options.getString('period') || 'all';
    const type = interaction.options.getString('type') || 'xp';

    if (!storage.getGuildSettings(guild.id).leveling.enabled) {
      const disabledEmbed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('ℹ️ Level & XP Tizimi O\'chirilgan')
        .setDescription(
          'Ushbu serverda Level & XP tizimi hozirda faol emas.\n\n' +
          '👑 **Administratorlar:** `/set-level status:Yoqish` buyrug\'i orqali tizimni faollashtirishi mumkin.'
        )
        .setTimestamp();

      return interaction.reply({ embeds: [disabledEmbed] });
    }

    // A'zolarni yuklash bir necha soniya olishi mumkin
    await interaction.deferReply();

    const isMember = await getMemberFilter(guild);
    const { list } = storage.getLeaderboard(guild.id, { period, type, isMember });

    if (list.length === 0) {
      return interaction.editReply({
        content: `ℹ️ ${PERIOD_LABELS[period]} davomida bu ko'rsatkich bo'yicha faollik ko'rsatgan a'zolar yo'q. Chatda birinchi bo'lib yozing!`
      });
    }

    let page = 0;
    const message = await interaction.editReply({
      ...buildPage(guild, list, page, period, type),
      allowedMentions: { parse: [] }
    });

    if (list.length <= PAGE_SIZE) return;

    // Har kim varaqlay oladi; ro'yxat buyruq chaqirilgan paytdagi holat
    const collector = message.createMessageComponentCollector({ time: PAGER_TIMEOUT_MS });

    collector.on('collect', async i => {
      const pageCount = Math.ceil(list.length / PAGE_SIZE);
      if (i.customId === 'leaderboard_prev') page = Math.max(0, page - 1);
      if (i.customId === 'leaderboard_next') page = Math.min(pageCount - 1, page + 1);
      await i.update(buildPage(guild, list, page, period, type)).catch(() => {});
    });

    collector.on('end', () => {
      interaction.editReply({ components: [] }).catch(() => {});
    });
  }
};
