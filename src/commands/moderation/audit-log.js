const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, AuditLogEvent } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('audit-log')
    .setDescription('Serverda xabarlarni kim o\'chirgani yoki AutoMod bloklashlarini ko\'rsatadi')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addStringOption(option =>
      option.setName('tur')
        .setDescription('Ko\'rish kerak bo\'lgan harakat turi')
        .setRequired(false)
        .addChoices(
          { name: '🗑️ Xabar o\'chirishlar (Message Delete)', value: 'delete' },
          { name: '🛡️ Discord AutoMod bloklashlari', value: 'automod' },
          { name: '📋 Barchasi (O\'chirishlar va AutoMod)', value: 'all' }
        )
    )
    .addIntegerOption(option =>
      option.setName('soni')
        .setDescription('Nechta oxirgi yozuvni ko\'rsatish (1 dan 15 gacha, standart: 8)')
        .setMinValue(1)
        .setMaxValue(15)
        .setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const guild = interaction.guild;
    const tur = interaction.options.getString('tur') || 'all';
    const limit = interaction.options.getInteger('soni') || 8;

    // Botda ViewAuditLog ruxsati bor-yo'qligini tekshirish
    const me = guild.members.me || await guild.members.fetchMe().catch(() => null);
    if (!me || !me.permissions.has(PermissionFlagsBits.ViewAuditLog)) {
      return interaction.editReply({
        content: '❌ **Xatolik:** Botda `View Audit Log` (Audit Jurnalini Ko\'rish) ruxsati yo\'q! Iltimos, server sozlamalarida bot roliga ushbu ruxsatni bering.'
      });
    }

    try {
      const entries = [];

      // 1. Message Delete yozuvlarini olish
      if (tur === 'delete' || tur === 'all') {
        const deleteLogs = await guild.fetchAuditLogs({
          limit: limit,
          type: AuditLogEvent.MessageDelete
        }).catch(() => null);

        if (deleteLogs) {
          deleteLogs.entries.forEach(e => {
            entries.push({
              type: 'delete',
              actionName: '🗑️ Xabar O\'chirilishi',
              executor: e.executor,
              target: e.target,
              channelId: e.extra?.channel?.id,
              count: e.extra?.count || 1,
              reason: e.reason,
              timestamp: e.createdTimestamp
            });
          });
        }
      }

      // 2. AutoMod yozuvlarini olish
      if (tur === 'automod' || tur === 'all') {
        const autoModLogs = await guild.fetchAuditLogs({
          limit: limit,
          type: AuditLogEvent.AutoModerationBlockMessage
        }).catch(() => null);

        if (autoModLogs) {
          autoModLogs.entries.forEach(e => {
            entries.push({
              type: 'automod',
              actionName: '🛡️ Discord AutoMod Bloklashi',
              executor: e.executor,
              target: e.target,
              channelId: e.extra?.channel?.id,
              ruleName: e.extra?.ruleName,
              reason: e.reason,
              timestamp: e.createdTimestamp
            });
          });
        }
      }

      // Saralash: eng yangi yozuvlar tepada
      entries.sort((a, b) => b.timestamp - a.timestamp);
      const displayEntries = entries.slice(0, limit);

      if (displayEntries.length === 0) {
        const emptyEmbed = new EmbedBuilder()
          .setColor(0xFEE75C)
          .setTitle('🔍 Audit Jurnali: Xabar O\'chirishlar Topilmadi')
          .setDescription(
            'Oxirgi audit loglarda botlar yoki moderatorlar tomonidan o\'chirilgan xabarlar topilmadi.\n\n' +
            '💡 **Muhim eslatma:**\n' +
            '• Agar foydalanuvchi **o\'z xabarini o\'zi** o\'chirsa, Discord buni Audit Logga **YOZMAYDI**.\n' +
            '• Faqat **botlar** (masalan: Dyno, MEE6, Cleva) yoki **moderatorlar** birovning xabarini o\'chirgandagina bu yerda ko\'rinadi.\n' +
            '• Agar GIF darhol o\'chib ketayotgan bo\'lsa, serverdagi boshqa botlarni (Dyno, MEE6, ProBot) yoki Discordning o\'z **AutoMod** sozlamalarini tekshirib ko\'ring.'
          )
          .setFooter({ text: `Tekshiruvchi: ${interaction.user.tag}` })
          .setTimestamp();

        return interaction.editReply({ embeds: [emptyEmbed] });
      }

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('📋 Audit Jurnali: So\'nggi O\'chirilgan Xabarlar')
        .setDescription(
          `Quyida serverda xabarlarni kim, qachon va nima sababdan o'chirganligi ko'rsatilgan:\n\n` +
          displayEntries.map((item, idx) => {
            const timeStr = `<t:${Math.floor(item.timestamp / 1000)}:R>`;
            let executorStr = 'Noma\'lum';
            if (item.executor) {
              const isBot = item.executor.bot ? '🤖 ' : '👤 ';
              executorStr = `${isBot}**${item.executor.tag}** (<@${item.executor.id}>)`;
            } else if (item.type === 'automod') {
              executorStr = '🛡️ **Discord AutoMod**';
            }

            const targetStr = item.target ? `**${item.target.tag || item.target.username}** (<@${item.target.id}>)` : 'Noma\'lum a\'zo';
            const channelStr = item.channelId ? `<#${item.channelId}>` : 'Noma\'lum kanal';
            const reasonStr = item.ruleName ? `Qoida: \`${item.ruleName}\`` : (item.reason ? `Sabab: \`${item.reason}\`` : '*Sabab ko\'rsatilmagan*');

            return `**${idx + 1}. ${item.actionName}** • ${timeStr}\n` +
                   `• **Kim o'chirdi:** ${executorStr}\n` +
                   `• **Kimning xabari:** ${targetStr}\n` +
                   `• **Kanal:** ${channelStr}\n` +
                   `• **Tafsilot:** ${reasonStr}`;
          }).join('\n\n')
        )
        .setFooter({ text: `Jami ko'rsatildi: ${displayEntries.length} ta yozuv` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('audit-log buyrug\'ida xatolik:', error);
      await interaction.editReply({
        content: `❌ Audit jurnalini o'qishda xatolik yuz berdi: ${error.message}`
      });
    }
  }
};
