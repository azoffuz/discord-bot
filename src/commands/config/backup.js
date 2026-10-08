const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  AttachmentBuilder,
  MessageFlags
} = require('discord.js');
const backupManager = require('../../utils/backupManager');
const log = require('../../utils/log');

function buildSectionsText(sections, counts) {
  const parts = [];
  if (sections.roles) parts.push(`👑 ${counts.roles} ta rol`);
  if (sections.channels) parts.push(`💬 ${counts.channels} ta kanal`);
  if (sections.emojis) parts.push(`😀 ${counts.emojis} ta emoji`);
  if (sections.settings) parts.push('⚙️ bot sozlamalari');
  return parts.length ? parts.join(', ') : 'bo\'sh';
}

async function handleCreate(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const guild = interaction.guild;

  const sections = {
    roles: interaction.options.getBoolean('roles') ?? true,
    channels: interaction.options.getBoolean('channels') ?? true,
    settings: interaction.options.getBoolean('settings') ?? true,
    emojis: interaction.options.getBoolean('emojis') ?? false
  };

  const data = backupManager.serializeGuild(guild, { sections });
  const { id, size } = await backupManager.saveBackup(guild, data);

  const json = JSON.stringify(data, null, 2);
  const file = new AttachmentBuilder(Buffer.from(json, 'utf8'), {
    name: `cleva-backup-${id}.json`
  });

  const embed = new EmbedBuilder()
    .setColor(0x57F287)
    .setTitle('💾 Server Zaxirasi Yaratildi')
    .setDescription(
      `**${guild.name}** serverining zaxira nusxasi muvaffaqiyatli yaratildi va saqlandi.\n\n` +
      `🆔 **Zaxira ID:** \`${id}\`\n` +
      `📦 **Hajmi:** ${(size / 1024).toFixed(1)} KB\n` +
      `🗂️ **Tarkibi:** ${buildSectionsText(sections, data.meta.counts)}`
    )
    .setFooter({ text: 'Cleva Backup System • Faylni xavfsiz joyda saqlang' })
    .setTimestamp();

  return interaction.editReply({ embeds: [embed], files: [file] });
}

async function handleList(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const list = await backupManager.listBackups(25);
  if (list.length === 0) {
    return interaction.editReply({
      content: '📭 Hozircha saqlangan zaxira nusxalar mavjud emas. `/backup create` orqali yarating.'
    });
  }

  const lines = list.map((b, i) => {
    const meta = b.meta || {};
    const counts = meta.counts || {};
    const when = meta.createdAt
      ? `<t:${Math.floor(new Date(meta.createdAt).getTime() / 1000)}:R>`
      : 'noma\'lum';
    return `**${i + 1}.** \`${b.id}\`\n┗ ${meta.guildName || 'Noma\'lum'} • ${when} • ` +
      `${counts.roles || 0} rol, ${counts.channels || 0} kanal`;
  });

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('🗂️ Saqlangan Zaxira Nusxalar')
    .setDescription(lines.join('\n\n').slice(0, 4000))
    .setFooter({ text: `Jami: ${list.length} ta` })
    .setTimestamp();

  return interaction.editReply({ embeds: [embed] });
}

async function handleLoad(interaction) {
  const confirmed = interaction.options.getBoolean('confirm');
  if (!confirmed) {
    return interaction.reply({
      content:
        '⚠️ Tiklash uchun `confirm` parametrini **true** qilib belgilang. ' +
        'Bu amal serverda yetishmayotgan rollar va kanallarni yaratadi.',
      flags: MessageFlags.Ephemeral
    });
  }

  const backupId = interaction.options.getString('backup_id');
  const file = interaction.options.getAttachment('file');

  if (!backupId && !file) {
    return interaction.reply({
      content: '❌ Iltimos, `backup_id` kiriting yoki `file` sifatida .json zaxira faylini biriktiring.',
      flags: MessageFlags.Ephemeral
    });
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const guild = interaction.guild;

  let data;
  try {
    if (file) {
      const res = await fetch(file.url);
      if (!res.ok) throw new Error(`Faylni yuklab olishda xato (HTTP ${res.status})`);
      data = JSON.parse(await res.text());
    } else {
      data = await backupManager.readBackup(backupId);
    }
  } catch (err) {
    log.error('Zaxirani o\'qishda xatolik:', err.message);
    return interaction.editReply({ content: `❌ Zaxira faylini o\'qib bo\'lmadi: ${err.message}` });
  }

  if (!data || typeof data !== 'object' ||
      (!data.roles && !data.channels && !data.settings && !data.emojis)) {
    return interaction.editReply({
      content: '❌ Fayl formati noto\'g\'ri yoki bo\'sh. Cleva zaxira (backup) faylini kiriting.'
    });
  }

  const result = await backupManager.applyBackup(guild, data);

  const embed = new EmbedBuilder()
    .setColor(result.errors.length ? 0xFEE75C : 0x57F287)
    .setTitle('♻️ Zaxira Tiklandi')
    .setDescription(
      `**Manba:** ${data.meta?.guildName || 'Noma\'lum'}` +
      (data.meta?.createdAt ? ` (${new Date(data.meta.createdAt).toLocaleString()})` : '') +
      `\n**Maqsad:** ${guild.name}`
    )
    .addFields(
      {
        name: '👑 Rollar',
        value: `Yaratildi: **${result.rolesCreated}**\nMavjud: **${result.rolesSkipped}**`,
        inline: true
      },
      {
        name: '💬 Kanallar',
        value: `Yaratildi: **${result.channelsCreated}**\nMavjud: **${result.channelsSkipped}**`,
        inline: true
      },
      {
        name: '⚙️ Sozlamalar',
        value: result.settingsApplied ? '✅ Tiklandi' : '➖ Tiklanmadi',
        inline: true
      }
    );

  if (result.emojisCreated) {
    embed.addFields({ name: '😀 Emojilar', value: `${result.emojisCreated} ta qo\'shildi`, inline: true });
  }
  if (result.warnings.length) {
    embed.addFields({ name: '💡 Eslatmalar', value: result.warnings.join('\n').slice(0, 1000) });
  }
  if (result.errors.length) {
    const shown = result.errors.slice(0, 8).join('\n');
    const more = result.errors.length > 8 ? `\n...va yana ${result.errors.length - 8} ta` : '';
    embed.addFields({ name: '⚠️ Xatoliklar', value: (shown + more).slice(0, 1000) });
  }

  embed.setFooter({ text: 'Cleva Backup System' }).setTimestamp();
  return interaction.editReply({ embeds: [embed] });
}

async function handleDelete(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const id = interaction.options.getString('backup_id');
  const ok = await backupManager.deleteBackup(id);

  if (!ok) {
    return interaction.editReply({
      content: `❌ \`${id}\` ID bilan zaxira topilmadi yoki o\'chirib bo\'lmadi.`
    });
  }

  return interaction.editReply({ content: `🗑️ \`${id}\` zaxira nusxasi o\'chirildi.` });
}

module.exports = {
  cooldown: 10,

  data: new SlashCommandBuilder()
    .setName('backup')
    .setDescription('Server tuzilmasi, rollari, kanallari va bot sozlamalarini JSON ga zaxiralash yoki tiklash')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)
    .addSubcommand(sub =>
      sub
        .setName('create')
        .setDescription('Serverning JSON zaxira nusxasini yaratadi va faylni yuklab beradi')
        .addBooleanOption(option =>
          option.setName('roles').setDescription('Rollarni ham zaxiralash (standart: ha)').setRequired(false)
        )
        .addBooleanOption(option =>
          option.setName('channels').setDescription('Kanal va kategoriyalarni zaxiralash (standart: ha)').setRequired(false)
        )
        .addBooleanOption(option =>
          option.setName('settings').setDescription('Bot sozlamalarini zaxiralash (standart: ha)').setRequired(false)
        )
        .addBooleanOption(option =>
          option.setName('emojis').setDescription('Emojilarni ham zaxiralash (standart: yo\'q)').setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('list')
        .setDescription('Saqlangan zaxira nusxalar ro\'yxatini ko\'rsatadi')
    )
    .addSubcommand(sub =>
      sub
        .setName('load')
        .setDescription('Zaxiradan serverni tiklaydi (faqat yetishmayotganlarini yaratadi)')
        .addStringOption(option =>
          option.setName('backup_id').setDescription('Saqlangan zaxira ID (list orqali olinadi)').setRequired(false)
        )
        .addAttachmentOption(option =>
          option.setName('file').setDescription('Oldin yuklab olingan .json zaxira fayli').setRequired(false)
        )
        .addBooleanOption(option =>
          option.setName('confirm').setDescription('Tiklashni tasdiqlaysizmi? (true bo\'lishi shart)').setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('delete')
        .setDescription('Saqlangan zaxira nusxani o\'chiradi')
        .addStringOption(option =>
          option.setName('backup_id').setDescription('O\'chiriladigan zaxira ID').setRequired(true)
        )
    ),

  async execute(interaction) {
    const isOwner = process.env.OWNER_ID && interaction.user.id === process.env.OWNER_ID.trim();
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator) && !isOwner) {
      return interaction.reply({
        content: '❌ Ushbu buyruqdan faqat `Administrator` ruxsatiga ega a\'zolar foydalana oladi.',
        flags: MessageFlags.Ephemeral
      });
    }

    const sub = interaction.options.getSubcommand();
    if (sub === 'create') return handleCreate(interaction);
    if (sub === 'list') return handleList(interaction);
    if (sub === 'load') return handleLoad(interaction);
    if (sub === 'delete') return handleDelete(interaction);
  }
};
