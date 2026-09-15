const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const storage = require('../../config/storage');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('del-warn')
    .setDescription('Foydalanuvchi xabarini o\'chiradi va unga rasmiy ogohlantirish (warn) beradi')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false)
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Ogohlantiriladigan foydalanuvchi')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Ogohlantirish sababi')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('message_id')
        .setDescription('O\'chirilishi kerak bo\'lgan xabar ID si (bo\'sh qolsa, eng oxirgi xabari o\'chiriladi)')
        .setRequired(false)
    ),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason');
    const messageId = interaction.options.getString('message_id');
    const channel = interaction.channel;
    const guild = interaction.guild;

    if (targetUser.bot) {
      return interaction.reply({
        content: '❌ Botlarga ogohlantirish berib bo\'lmaydi.',
        ephemeral: true
      });
    }

    await interaction.deferReply();

    let deletedMessageContent = null;
    let messageDeleted = false;

    try {
      if (messageId) {
        // Berilgan xabar ID sini topib o'chirish
        const msg = await channel.messages.fetch(messageId).catch(() => null);
        if (msg) {
          deletedMessageContent = msg.content;
          await msg.delete().catch(() => null);
          messageDeleted = true;
        }
      } else {
        // Kanaldagi oxirgi 50 xabardan ushbu foydalanuvchining eng oxirgisini topish
        const messages = await channel.messages.fetch({ limit: 50 }).catch(() => null);
        if (messages) {
          const userMsg = messages.find(m => m.author.id === targetUser.id);
          if (userMsg) {
            deletedMessageContent = userMsg.content;
            await userMsg.delete().catch(() => null);
            messageDeleted = true;
          }
        }
      }

      // Ogohlantirishni bazaga saqlash
      const warnResult = storage.addWarn(guild.id, targetUser.id, reason, interaction.user.id);

      // Foydalanuvchiga DM yuborish
      await targetUser.send({
        content: `⚠️ Siz **${guild.name}** serverida ogohlantirildingiz!\n**Sabab:** ${reason}\n**Jami ogohlantirishlaringiz:** ${warnResult.totalWarns} ta`
      }).catch(() => {});

      const embed = new EmbedBuilder()
        .setColor(0xFEE75C)
        .setTitle('⚠️ Foydalanuvchi Ogohlantirildi va Xabari O\'chirildi')
        .setDescription(`${targetUser} (<@${targetUser.id}>) ga ogohlantirish berildi.`)
        .addFields(
          { name: 'Sabab', value: reason, inline: false },
          { name: 'Xabar holati', value: messageDeleted ? '✅ Xabar topildi va o\'chirildi' : '⚠️ Xabar topilmadi (faqat ogohlantirish berildi)', inline: true },
          { name: 'Jami ogohlantirishlar', value: `**${warnResult.totalWarns}** ta`, inline: true },
          { name: 'Moderator', value: `${interaction.user.tag}`, inline: true }
        )
        .setFooter({ text: `Warn ID: ${warnResult.warn.id}` })
        .setTimestamp();

      if (deletedMessageContent) {
        embed.addFields({
          name: 'O\'chirilgan xabar matni',
          value: deletedMessageContent.slice(0, 1024)
        });
      }

      await interaction.editReply({ embeds: [embed] });

      // Log kanaliga yozish
      await logger.logModAction(
        guild,
        'Del-Warn (Xabar o\'chirildi va ogohlantirildi)',
        interaction.user,
        targetUser,
        reason,
        `Jami warnlar: ${warnResult.totalWarns} ta | Xabar o'chirildimi: ${messageDeleted ? 'Ha' : 'Yo\'q'}`
      );
    } catch (error) {
      console.error('del-warn xatosi:', error);
      await interaction.editReply({
        content: `❌ Buyruq bajarishda xatolik: ${error.message}`
      });
    }
  }
};
