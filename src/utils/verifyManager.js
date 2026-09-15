const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  MessageFlags
} = require('discord.js');
const storage = require('../config/storage');
const logger = require('./logger');
const log = require('./log');

async function handleVerifyInteraction(interaction) {
  const { guild } = interaction;
  if (!guild) return false;

  // 1. TUGMA BOSILGANDA (verify_start)
  if (interaction.isButton() && interaction.customId === 'verify_start') {
    const settings = storage.getGuildSettings(guild.id);
    if (!settings.verification || !settings.verification.enabled) {
      await interaction.reply({
        content: '❌ Ushbu serverda tekshiruv tizimi faol emas yoki o\'chirilgan.',
        flags: MessageFlags.Ephemeral
      });
      return true;
    }

    const { roleId, type = 'button' } = settings.verification;
    const role = await guild.roles.fetch(roleId).catch(() => null);
    if (!role) {
      await interaction.reply({
        content: '❌ Tekshiruv roli serverda topilmadi. Iltimos, ma\'muriyatga murojaat qiling.',
        flags: MessageFlags.Ephemeral
      });
      return true;
    }

    // A'zoda allaqachon rol bormi?
    if (interaction.member.roles.cache.has(role.id)) {
      await interaction.reply({
        content: 'ℹ️ Siz allaqachon tekshiruvdan o\'tgansiz va server a\'zosisiz!',
        flags: MessageFlags.Ephemeral
      });
      return true;
    }

    // Bot ierarxiyasini tekshirish
    const me = guild.members.me || await guild.members.fetchMe().catch(() => null);
    if (me && me.roles.highest.position <= role.position) {
      await interaction.reply({
        content: `❌ Botning roli tekshiruv rolidan (${role.name}) pastda joylashgan. Iltimos, server administratoriga xabar bering.`,
        flags: MessageFlags.Ephemeral
      });
      return true;
    }

    // A) ODDIY TUGMA USULI (button)
    if (type === 'button') {
      try {
        await interaction.member.roles.add(role, 'Cleva Tekshiruv (Verification) tizimi');
        await logger.logMemberVerify(interaction.member, role, 'button');
        await interaction.reply({
          content: `🎉 **Tabriklaymiz!** Siz muvaffaqiyatli tekshiruvdan o'tdingiz va server a'zosi bo'ldingiz! Sizga <@&${role.id}> roli berildi.`,
          flags: MessageFlags.Ephemeral
        });
      } catch (err) {
        log.error('[VERIFY BUTTON ERROR]:', err);
        await interaction.reply({
          content: '❌ Rolni berishda xatolik yuz berdi. Iltimos, administratorga murojaat qiling.',
          flags: MessageFlags.Ephemeral
        });
      }
      return true;
    }

    // B) 4 XONALI KOD USULI (code)
    if (type === 'code') {
      const randomCode = Math.floor(1000 + Math.random() * 9000).toString();
      const modal = new ModalBuilder()
        .setCustomId(`verify_code_modal_${randomCode}`)
        .setTitle('🛡️ Xavfsizlik Kodi');

      const codeInput = new TextInputBuilder()
        .setCustomId('code_input')
        .setLabel(`Quyidagi kodni kiriting: [ ${randomCode} ]`)
        .setStyle(TextInputStyle.Short)
        .setPlaceholder(`Masalan: ${randomCode}`)
        .setMinLength(4)
        .setMaxLength(4)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(codeInput));
      await interaction.showModal(modal);
      return true;
    }

    // C) MATEMATIK MISOL USULI (math)
    if (type === 'math') {
      const num1 = Math.floor(Math.random() * 15) + 1;
      const num2 = Math.floor(Math.random() * 15) + 1;
      const answer = num1 + num2;

      const modal = new ModalBuilder()
        .setCustomId(`verify_math_modal_${answer}`)
        .setTitle('🧮 Matematik Misol');

      const mathInput = new TextInputBuilder()
        .setCustomId('math_input')
        .setLabel(`Misolni yeching: ${num1} + ${num2} = ?`)
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Javobni faqat son bilan yozing (masalan: 12)')
        .setMinLength(1)
        .setMaxLength(5)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(mathInput));
      await interaction.showModal(modal);
      return true;
    }
  }

  // 2. MODAL TOPSHIRILGANDA (Modal Submit)
  if (interaction.isModalSubmit()) {
    // 2.1. KODNI TEKSHIRISH
    if (interaction.customId.startsWith('verify_code_modal_')) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const expectedCode = interaction.customId.split('_')[3];
      const userInput = interaction.fields.getTextInputValue('code_input')?.trim();

      const settings = storage.getGuildSettings(guild.id);
      if (!settings.verification || !settings.verification.enabled) {
        return interaction.editReply({
          content: '❌ Tekshiruv tizimi hozirda faol emas.'
        });
      }

      const role = await guild.roles.fetch(settings.verification.roleId).catch(() => null);
      if (!role) {
        return interaction.editReply({
          content: '❌ Tekshiruv roli serverda topilmadi.'
        });
      }

      if (userInput === expectedCode) {
        try {
          await interaction.member.roles.add(role, 'Cleva Tekshiruv (Verification) tizimi');
          await logger.logMemberVerify(interaction.member, role, 'code');
          return interaction.editReply({
            content: `🎉 **Kod to'g'ri!** Siz muvaffaqiyatli tekshiruvdan o'tdingiz va server a'zosi bo'ldingiz! Sizga <@&${role.id}> roli berildi.`
          });
        } catch (err) {
          log.error('[VERIFY MODAL CODE ERROR]:', err);
          return interaction.editReply({
            content: '❌ Rolni berishda xatolik yuz berdi. Iltimos, administratorga murojaat qiling.'
          });
        }
      } else {
        return interaction.editReply({
          content: '❌ **Kod noto\'g\'ri kiritildi!** Iltimos, tekshiruv tugmasini qaytadan bosib, ko\'rsatilgan kodni to\'g\'ri kiriting.'
        });
      }
    }

    // 2.2. MATEMATIK MISOLNI TEKSHIRISH
    if (interaction.customId.startsWith('verify_math_modal_')) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const expectedAnswer = parseInt(interaction.customId.split('_')[3], 10);
      const userAnswer = parseInt(interaction.fields.getTextInputValue('math_input')?.trim(), 10);

      const settings = storage.getGuildSettings(guild.id);
      if (!settings.verification || !settings.verification.enabled) {
        return interaction.editReply({
          content: '❌ Tekshiruv tizimi hozirda faol emas.'
        });
      }

      const role = await guild.roles.fetch(settings.verification.roleId).catch(() => null);
      if (!role) {
        return interaction.editReply({
          content: '❌ Tekshiruv roli serverda topilmadi.'
        });
      }

      if (!isNaN(userAnswer) && userAnswer === expectedAnswer) {
        try {
          await interaction.member.roles.add(role, 'Cleva Tekshiruv (Verification) tizimi');
          await logger.logMemberVerify(interaction.member, role, 'math');
          return interaction.editReply({
            content: `🎉 **To'g'ri javob!** Siz muvaffaqiyatli tekshiruvdan o'tdingiz va server a'zosi bo'ldingiz! Sizga <@&${role.id}> roli berildi.`
          });
        } catch (err) {
          log.error('[VERIFY MODAL MATH ERROR]:', err);
          return interaction.editReply({
            content: '❌ Rolni berishda xatolik yuz berdi. Iltimos, administratorga murojaat qiling.'
          });
        }
      } else {
        return interaction.editReply({
          content: '❌ **Noto\'g\'ri javob!** Iltimos, tekshiruv tugmasini qaytadan bosib, misolni to\'g\'ri hisoblang.'
        });
      }
    }
  }

  return false;
}

module.exports = {
  handleVerifyInteraction
};
