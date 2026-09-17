const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('renamechat')
    .setDescription('Barcha yoki tanlangan kanallardagi "・" belgisini "︱" ga almashtiradi')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false)
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Faqat bitta kanalni o\'zgartirish (bo\'sh qoldirilsa BARCHA kanallar o\'zgartiriladi)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('from')
        .setDescription('Qidiriladigan belgi (standart: "・")')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('to')
        .setDescription('Almashtiriladigan yangi belgi (standart: "︱")')
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option.setName('preview')
        .setDescription('Faqat ko\'rib chiqish (nomlarni o\'zgartirmasdan ro\'yxatni ko\'rish)')
        .setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply();
    const { guild } = interaction;

    // 1. Bot ruxsatini tekshirish
    const botMember = guild.members.me || await guild.members.fetchMe().catch(() => null);
    if (!botMember || !botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return interaction.editReply({
        content: '❌ **Xatolik:** Botda kanallarni boshqarish va qayta nomlash (**Manage Channels**) ruxsati yo\'q!'
      });
    }

    const targetChannel = interaction.options.getChannel('channel');
    const fromChar = interaction.options.getString('from') ?? '・';
    const toChar = interaction.options.getString('to') ?? '︱';
    const isPreview = interaction.options.getBoolean('preview') ?? false;

    if (!fromChar) {
      return interaction.editReply({
        content: '❌ Qidiriladigan belgi bo\'sh bo\'lishi mumkin emas!'
      });
    }

    // 2. YAGONA KANALNI O'ZGARTIRISH (Agar 'channel' parametri kiritilgan bo'lsa)
    if (targetChannel) {
      if (!targetChannel.name.includes(fromChar)) {
        return interaction.editReply({
          content: `ℹ️ <#${targetChannel.id}> kanalining nomida \`${fromChar}\` belgisi topilmadi.\n**Hozirgi nomi:** \`${targetChannel.name}\``
        });
      }

      const newName = targetChannel.name.replaceAll(fromChar, toChar);

      if (isPreview) {
        return interaction.editReply({
          content: `🔍 **Ko'rib chiqish (Preview):**\n• **Kanal:** <#${targetChannel.id}>\n• **Eski nomi:** \`${targetChannel.name}\`\n• **Yangi nomi:** \`${newName}\`\n\n*(Haqiqiy o'zgartirish uchun preview qilmasdan qayta yuboring).*`
        });
      }

      try {
        const oldName = targetChannel.name;
        await targetChannel.setName(newName);

        const embed = new EmbedBuilder()
          .setColor(0x57F287)
          .setTitle('✅ Kanal Nomi O\'zgartirildi')
          .setDescription(
            `**Kanal:** <#${targetChannel.id}>\n` +
            `**Eski nomi:** \`${oldName}\`\n` +
            `**Yangi nomi:** \`${newName}\`\n` +
            `**Almashtirish:** \`${fromChar}\` ➔ \`${toChar}\``
          )
          .setFooter({ text: `Ijrochi: ${interaction.user.tag}` })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

        await logger.logModAction(
          guild,
          'Kanal Qayta Nomlandi (/renamechat)',
          interaction.user,
          { name: oldName, id: targetChannel.id },
          `"${fromChar}" ➔ "${toChar}" (Yangi: ${newName})`
        ).catch(() => {});

      } catch (err) {
        console.error('Kanal nomini o\'zgartirishda xato:', err);
        return interaction.editReply({
          content: `❌ Kanal nomini o'zgartirishda xatolik yuz berdi: ${err.message}`
        });
      }
      return;
    }

    // 3. BUTUN SERVERDAGI BARCHA KANALLARNI QIDIRISH
    await guild.channels.fetch().catch(() => {});
    const matchingChannels = guild.channels.cache.filter(c => c && c.name && c.name.includes(fromChar));

    if (matchingChannels.size === 0) {
      return interaction.editReply({
        content: `ℹ️ Serverdagi hech qaysi kanal nomida \`${fromChar}\` belgisi topilmadi!\nBarcha kanallar nomi allaqachon to'g'ri.`
      });
    }

    // 4. PREVIEW (Faqat ko'rib chiqish)
    if (isPreview) {
      const previewList = [];
      for (const [, ch] of matchingChannels) {
        const proposed = ch.name.replaceAll(fromChar, toChar);
        previewList.push(`• \`${ch.name}\` ➔ \`${proposed}\` (<#${ch.id}>)`);
      }

      const displayList = previewList.slice(0, 20).join('\n');
      const extraCount = previewList.length > 20 ? `\n*...va yana ${previewList.length - 20} ta kanal*` : '';

      const previewEmbed = new EmbedBuilder()
        .setColor(0xFEE75C)
        .setTitle('🔍 Kanallarni Qayta Nomlash (Preview Rejimi)')
        .setDescription(
          `Quyidagi **${matchingChannels.size} ta** kanal nomida \`${fromChar}\` belgisi topildi va \`${toChar}\` ga o'zgaradi:\n\n` +
          `${displayList}${extraCount}\n\n` +
          `💡 *Haqiqiy o'zgartirishni boshlash uchun \`/renamechat\` buyrug'ini preview parametrisiz yuboring!*`
        )
        .setFooter({ text: `Tekshiruvchi: ${interaction.user.tag}` })
        .setTimestamp();

      return interaction.editReply({ embeds: [previewEmbed] });
    }

    // 5. HAQIQIY O'ZGARTIRISH (Rate limit xavfsizligi bilan)
    await interaction.editReply({
      content: `⏳ **Kanallarni qayta nomlash boshlandi...**\nJami topildi: **${matchingChannels.size} ta** kanal.\n*Discord cheklovlari (rate limit) sababli har bir kanal o'rtasida 1.2 soniya pauza qilinadi...*`
    });

    const renamed = [];
    const failed = [];

    for (const [, ch] of matchingChannels) {
      const oldName = ch.name;
      const newName = ch.name.replaceAll(fromChar, toChar);

      if (oldName === newName) continue;

      try {
        await ch.setName(newName);
        renamed.push({ id: ch.id, oldName, newName });
      } catch (err) {
        console.error(`Kanalni nomlashda xato (${ch.name}):`, err.message);
        failed.push({ id: ch.id, name: oldName, error: err.message });
      }

      // Discord Rate Limit oldini olish uchun 1200ms kutish
      await new Promise(resolve => setTimeout(resolve, 1200));
    }

    // 6. YAKUNIY NATIJA EMBEDI
    const resultEmbed = new EmbedBuilder()
      .setColor(failed.length === 0 ? 0x57F287 : 0xFEE75C)
      .setTitle('⚡ Kanallarni Qayta Nomlash Yakunlandi!')
      .setDescription(
        `Almashtirish amali muvaffaqiyatli bajarildi:\n\n` +
        `• **Qidirilgan belgi:** \`${fromChar}\`\n` +
        `• **Yangi belgi:** \`${toChar}\`\n` +
        `• ✅ **Muvaffaqiyatli o'zgardi:** **${renamed.length} ta kanal**\n` +
        (failed.length > 0 ? `• ⚠️ **O'zgarmagan / Xato:** **${failed.length} ta**\n` : '')
      )
      .setFooter({ text: `Ijrochi: ${interaction.user.tag}` })
      .setTimestamp();

    if (renamed.length > 0) {
      const sampleList = renamed.slice(0, 15).map(r => `• \`${r.oldName}\` ➔ \`${r.newName}\` (<#${r.id}>)`).join('\n');
      const moreText = renamed.length > 15 ? `\n*...va yana ${renamed.length - 15} ta kanal*` : '';
      resultEmbed.addFields({
        name: '📋 O\'zgartirilgan Kanallar (Namuna)',
        value: sampleList + moreText
      });
    }

    if (failed.length > 0) {
      resultEmbed.addFields({
        name: '❌ Xatolik bergan kanallar',
        value: failed.slice(0, 5).map(f => `• \`${f.name}\`: ${f.error}`).join('\n')
      });
    }

    await interaction.editReply({ content: null, embeds: [resultEmbed] });

    await logger.logModAction(
      guild,
      'Ommaviy Kanallar Qayta Nomlandi (/renamechat)',
      interaction.user,
      { name: `${renamed.length} ta kanal`, id: guild.id },
      `"${fromChar}" ➔ "${toChar}" (${renamed.length} ta kanal o'zgartirildi)`
    ).catch(() => {});
  }
};
