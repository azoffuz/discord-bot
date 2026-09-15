const {
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  RoleSelectMenuBuilder,
  MessageFlags
} = require('discord.js');
const storage = require('../config/storage');
const logger = require('../utils/logger');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    // 1. RUXSAT BERILGAN SERVERLAR CHEKLOVI (ALLOWED_GUILD_ID)
    const rawAllowed = process.env.ALLOWED_GUILD_ID || process.env.GUILD_ID || '';
    const allowedGuilds = rawAllowed
      .split(',')
      .map(id => id.trim())
      .filter(Boolean);

    if (allowedGuilds.length > 0) {
      if (interaction.guildId && !allowedGuilds.includes(interaction.guildId)) {
        const replyPayload = {
          content: '❌ Bu bot faqat maxsus ruxsat berilgan rasmiy serverlarda ishlaydi.',
          ephemeral: true
        };
        if (interaction.isRepliable()) {
          return interaction.reply(replyPayload).catch(() => {});
        }
        return;
      }
    }

    // 2. SLASH BUYRUQLAR (ChatInputCommand)
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) {
        console.warn(`Noma'lum buyruq chaqirildi: ${interaction.commandName}`);
        return;
      }

      try {
        await command.execute(interaction, client);
      } catch (error) {
        console.error(`Buyruq bajarilishida xatolik (${interaction.commandName}):`, error);

        const errorPayload = {
          content: '❌ Ushbu buyruqni bajarishda kutilmagan xatolik yuz berdi!',
          ephemeral: true
        };

        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(errorPayload).catch(() => {});
        } else {
          await interaction.reply(errorPayload).catch(() => {});
        }
      }
      return;
    }

    // 3. SHAXSIY OVOZLI XONALAR (TEMP VOICE) BOSHQARUVI
    const { handleTempVoiceInteraction } = require('../utils/tempVoiceManager');
    const handledTempVoice = await handleTempVoiceInteraction(interaction);
    if (handledTempVoice) return;

    // 3.1. O'YINGA DO'ST QIDIRISH (LFG) BOSHQARUVI
    const { handleLfgInteraction } = require('../utils/lfgManager');
    const handledLfg = await handleLfgInteraction(interaction);
    if (handledLfg) return;

    // 3.2. SERVER TEKSHIRUVI (VERIFICATION) BOSHQARUVI
    const { handleVerifyInteraction } = require('../utils/verifyManager');
    const handledVerify = await handleVerifyInteraction(interaction);
    if (handledVerify) return;

    // 3.3. MEGA TEAM ARXIVI (TEAM ARCHIVE) BOSHQARUVI
    const { handleTeamArchiveInteraction } = require('../utils/teamArchiveManager');
    const handledTeamArchive = await handleTeamArchiveInteraction(interaction);
    if (handledTeamArchive) return;

    // 3.4. AVATAR TUGMALARI BOSHQARUVI
    const { handleAvatarInteraction } = require('../commands/general/avatar');
    const handledAvatar = await handleAvatarInteraction(interaction);
    if (handledAvatar) return;

    // 4. TUGMALAR HODISALARI (Button Interactions)
    if (interaction.isButton()) {
      const { customId, guild, user } = interaction;

      // 4.1. YANGI TICKET UCHUN ANKETA MODALINI KO'RSATISH
      if (customId === 'ticket_create') {
        const settings = storage.getGuildSettings(guild.id);
        let category = settings.ticketCategoryId ? guild.channels.cache.get(settings.ticketCategoryId) : null;

        // Auto-recovery: Agar kategoriya xotiradan o'chgan bo'lsa, serverdan avtomatik topib tiklaydi
        if (!category) {
          category = guild.channels.cache.find(c =>
            c.type === ChannelType.GuildCategory &&
            (c.name.toLowerCase().includes('ticket') || c.name.toLowerCase().includes('murojaat'))
          );
          if (category) {
            console.log(`[TICKET TIKLANDI] Kategoriya avtomatik topildi: ${category.name} (${category.id})`);
            storage.updateGuildSettings(guild.id, { ticketCategoryId: category.id });
          }
        }

        if (!category) {
          return interaction.reply({
            content: '❌ Ticketlar kategoriyasi topilmadi. Iltimos, ma\'muriyat `/set-ticket` orqali kategoriyani belgilasin.',
            flags: MessageFlags.Ephemeral
          });
        }

        // Foydalanuvchining ochiq ticketi borligini tekshirish
        const existingTicket = category.children.cache.find(c =>
          c.topic && c.topic.includes(`OwnerID: ${user.id}`)
        );

        if (existingTicket) {
          return interaction.reply({
            content: `⚠️ Sizda allaqachon ochiq murojaat mavjud: <#${existingTicket.id}>`,
            flags: MessageFlags.Ephemeral
          });
        }

        // Anketani Modal ko'rinishida chiqarish
        const modal = new ModalBuilder()
          .setCustomId('ticket_modal_submit')
          .setTitle('📋 Rol Olish va Murojaat Anketasi');

        const nameAgeInput = new TextInputBuilder()
          .setCustomId('ticket_name_age')
          .setLabel('Ismingiz va Yoshingiz:')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Masalan: Ali, 18 yosh')
          .setRequired(true)
          .setMaxLength(50);

        const pcInput = new TextInputBuilder()
          .setCustomId('ticket_pc')
          .setLabel('Kompyuteringiz / qurilmangiz:')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Masalan: PC Core i5, GTX 1660, 16GB RAM')
          .setRequired(true)
          .setMaxLength(250);

        const gamesInput = new TextInputBuilder()
          .setCustomId('ticket_games')
          .setLabel('O\'ynaydigan o\'yinlaringiz:')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Masalan: CS2, Dota 2, GTA V, PUBG')
          .setRequired(true)
          .setMaxLength(250);

        const roleInput = new TextInputBuilder()
          .setCustomId('ticket_role_target')
          .setLabel('Qaysi rolni olmoqchisiz yoki maqsad:')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Masalan: CS2 O\'yinchisi yoki Yordam')
          .setRequired(true)
          .setMaxLength(100);

        modal.addComponents(
          new ActionRowBuilder().addComponents(nameAgeInput),
          new ActionRowBuilder().addComponents(pcInput),
          new ActionRowBuilder().addComponents(gamesInput),
          new ActionRowBuilder().addComponents(roleInput)
        );

        await interaction.showModal(modal);
        return;
      }

      // 4.2. ADMINGA ROL BERISH TUGMASI (TICKET ICHIDA)
      if (customId.startsWith('ticket_give_role_')) {
        const applicantId = customId.replace('ticket_give_role_', '');
        const settings = storage.getGuildSettings(guild.id);
        const isOwner = process.env.OWNER_ID && user.id === process.env.OWNER_ID.trim();
        const member = interaction.member;
        const isStaff = isOwner ||
          member.permissions.has(PermissionFlagsBits.Administrator) ||
          member.permissions.has(PermissionFlagsBits.ManageRoles) ||
          (settings.supportRoleId && member.roles.cache.has(settings.supportRoleId));

        if (!isStaff) {
          return interaction.reply({
            content: '❌ Ushbu amalni faqat administrator va moderatorlar bajara oladi!',
            flags: MessageFlags.Ephemeral
          });
        }

        const roleSelect = new RoleSelectMenuBuilder()
          .setCustomId(`ticket_role_select_${applicantId}`)
          .setPlaceholder('Arizachiga beriladigan rolni tanlang...')
          .setMinValues(1)
          .setMaxValues(1);

        await interaction.reply({
          content: `👑 **<@${applicantId}> ga qaysi rolni bermoqchisiz?**\n*Eslatma: Faqat o'zingizning va botning rolidan pastdagi rollarni bera olasiz.*`,
          components: [new ActionRowBuilder().addComponents(roleSelect)],
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      // 3.2. TICKETNI YOPISH
      if (customId === 'ticket_close') {
        const channel = interaction.channel;

        const closingEmbed = new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle('🔒 Murojaat Yopilmoqda')
          .setDescription(`Ushbu ticket **5 soniyadan so'ng** butunlay yopiladi va o'chiriladi...\n*Yozishmalar tarixi (transcript) log kanaliga saqlanmoqda.*`)
          .setFooter({ text: `Yopuvchi: ${user.tag}` })
          .setTimestamp();

        await interaction.reply({ embeds: [closingEmbed] });

        // Transcript (yozishmalar tarixi)ni yig'ish
        let transcriptFile = null;
        try {
          const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
          if (messages && messages.size > 0) {
            const sorted = Array.from(messages.values()).reverse();
            let transcriptText = `====================================================\n`;
            transcriptText += `CLEVA TICKET TRANSCRIPT\n`;
            transcriptText += `Server: ${guild.name}\n`;
            transcriptText += `Kanal: #${channel.name}\n`;
            transcriptText += `Yopuvchi: ${user.tag} (${user.id})\n`;
            transcriptText += `Sana: ${new Date().toLocaleString()}\n`;
            transcriptText += `====================================================\n\n`;

            for (const msg of sorted) {
              const author = msg.author ? `${msg.author.tag} (${msg.author.id})` : 'Noma\'lum';
              const time = new Date(msg.createdTimestamp).toLocaleString();
              transcriptText += `[${time}] ${author}:\n`;
              if (msg.content) transcriptText += `${msg.content}\n`;
              if (msg.embeds && msg.embeds.length > 0) {
                for (const emb of msg.embeds) {
                  transcriptText += `  [EMBED] ${emb.title || ''}: ${emb.description || ''}\n`;
                }
              }
              if (msg.attachments && msg.attachments.size > 0) {
                transcriptText += `  [FAYLLAR]: ${msg.attachments.map(a => a.url).join(', ')}\n`;
              }
              transcriptText += `\n`;
            }

            transcriptFile = new AttachmentBuilder(Buffer.from(transcriptText, 'utf-8'), {
              name: `transcript-${channel.name}.txt`
            });
          }
        } catch (err) {
          console.error('Transcript yig\'ishda xatolik:', err.message);
        }

        // Ticket log kanaliga hisobot va faylni yuborish
        const logEmbed = new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle('🔒 Ticket Yopildi va Arxivlandi')
          .setDescription(`**Kanal:** #${channel.name}\n**Yopgan shaxs:** ${user.tag} (<@${user.id}>)\n**Transcript:** ${transcriptFile ? 'Biriktirildi (.txt)' : 'Yozishmalar mavjud emas'}`)
          .setTimestamp();

        await logger.logTicketAction(guild, logEmbed, transcriptFile ? [transcriptFile] : []);

        setTimeout(async () => {
          await channel.delete('Ticket muvaffaqiyatli yopildi').catch(() => {});
        }, 5000);
        return;
      }
    }

    // 5. MODAL TOPSHIRISH (Modal Submit Interactions)
    if (interaction.isModalSubmit()) {
      const { customId, guild, user } = interaction;

      if (customId === 'ticket_modal_submit') {
        const nameAge = interaction.fields.getTextInputValue('ticket_name_age');
        const pc = interaction.fields.getTextInputValue('ticket_pc');
        const games = interaction.fields.getTextInputValue('ticket_games');
        const roleTarget = interaction.fields.getTextInputValue('ticket_role_target');

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
          const settings = storage.getGuildSettings(guild.id);
          let category = settings.ticketCategoryId ? guild.channels.cache.get(settings.ticketCategoryId) : null;

          // Auto-recovery: Agar kategoriya xotiradan o'chgan bo'lsa, serverdan avtomatik topib tiklaydi
          if (!category) {
            category = guild.channels.cache.find(c =>
              c.type === ChannelType.GuildCategory &&
              (c.name.toLowerCase().includes('ticket') || c.name.toLowerCase().includes('murojaat'))
            );
            if (category) {
              console.log(`[TICKET TIKLANDI] Kategoriya avtomatik topildi: ${category.name} (${category.id})`);
              storage.updateGuildSettings(guild.id, { ticketCategoryId: category.id });
            }
          }

          if (!category) {
            return interaction.editReply({
              content: '❌ Ticketlar kategoriyasi topilmadi. Iltimos, ma\'muriyat `/set-ticket` orqali kategoriyani belgilasin.'
            });
          }

          // Foydalanuvchining ochiq ticketi borligini tekshirish
          const existingTicket = category.children.cache.find(c =>
            c.topic && c.topic.includes(`OwnerID: ${user.id}`)
          );

          if (existingTicket) {
            return interaction.editReply({
              content: `⚠️ Sizda allaqachon ochiq murojaat mavjud: <#${existingTicket.id}>`
            });
          }

          // Yangi ticket raqamini oshirish
          const ticketNumber = (settings.ticketCounter || 0) + 1;
          storage.updateGuildSettings(guild.id, { ticketCounter: ticketNumber });

          const formattedNumber = String(ticketNumber).padStart(4, '0');

          // Kanal ruxsatlari
          const permissionOverwrites = [
            {
              id: guild.roles.everyone.id,
              deny: [PermissionFlagsBits.ViewChannel]
            },
            {
              id: user.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.AttachFiles,
                PermissionFlagsBits.EmbedLinks
              ]
            },
            {
              id: guild.members.me.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.ManageChannels,
                PermissionFlagsBits.ManageMessages
              ]
            }
          ];

          if (settings.supportRoleId) {
            permissionOverwrites.push({
              id: settings.supportRoleId,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.AttachFiles,
                PermissionFlagsBits.EmbedLinks
              ]
            });
          }

          // Kanal yaratish
          const ticketChannel = await guild.channels.create({
            name: `🎫・ticket-${formattedNumber}`,
            type: ChannelType.GuildText,
            parent: category.id,
            topic: `Ticket #${formattedNumber} | OwnerID: ${user.id}`,
            permissionOverwrites
          });

          // Embed yaratish: To'ldirilgan anketa va ma'lumotlar
          const welcomeEmbed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle(`🎫 Murojaat va Rol So'rovi #${formattedNumber}`)
            .setDescription(
              `Assalomu alaykum, ${user}!\n` +
              `Sizning anketangiz va murojaatingiz muvaffaqiyatli qabul qilindi. Tez orada administratorlar ko'rib chiqadi.\n\n` +
              `📋 **To'ldirilgan Anketa Ma'lumotlari:**\n` +
              `• 👤 **Ismi va Yoshi:** \`${nameAge}\`\n` +
              `• 💻 **Qurilmasi (PC):** \`${pc}\`\n` +
              `• 🎮 **O'yinlari:** \`${games}\`\n` +
              `• 🎯 **So'ralgan Rol / Maqsad:** \`${roleTarget}\`\n\n` +
              `📌 *Ma'muriyat quyidagi tugma orqali arizachiga to'g'ridan-to'g'ri rol biriktirishi mumkin.*`
            )
            .setThumbnail(user.displayAvatarURL({ dynamic: true }))
            .setFooter({ text: `Arizachi ID: ${user.id} • Cleva Ticket Tizimi` })
            .setTimestamp();

          const buttonRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`ticket_give_role_${user.id}`)
              .setLabel('Rol Berish')
              .setEmoji('👑')
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId('ticket_close')
              .setLabel('Ticketni Yopish')
              .setEmoji('🔒')
              .setStyle(ButtonStyle.Danger)
          );

          await ticketChannel.send({
            content: `${user} ${settings.supportRoleId ? `<@&${settings.supportRoleId}>` : ''}`,
            embeds: [welcomeEmbed],
            components: [buttonRow]
          });

          await interaction.editReply({
            content: `✅ Murojaatingiz ochildi: <#${ticketChannel.id}>`
          });

          // Log kanaliga yozish
          await logger.logTicketAction(
            guild,
            new EmbedBuilder()
              .setColor(0x57F287)
              .setTitle('📩 Yangi Ticket Ochildi (Anketa bilan)')
              .setDescription(
                `**Foydalanuvchi:** ${user.tag} (<@${user.id}>)\n` +
                `**Kanal:** <#${ticketChannel.id}>\n` +
                `**Ticket:** #${formattedNumber}\n` +
                `**Ism va Yosh:** ${nameAge}\n` +
                `**Qurilma:** ${pc}\n` +
                `**O'yinlar:** ${games}\n` +
                `**Rol / Maqsad:** ${roleTarget}`
              )
              .setTimestamp()
          );
        } catch (error) {
          console.error('Ticket ochishda xatolik:', error);
          await interaction.editReply({
            content: `❌ Ticket ochishda xatolik: ${error.message}`
          });
        }
        return;
      }
    }

    // 6. ROL TANLASH MENYUSI (Role Select Menu)
    if (interaction.isRoleSelectMenu()) {
      const { customId, guild, user, member, values } = interaction;

      if (customId.startsWith('ticket_role_select_')) {
        const applicantId = customId.replace('ticket_role_select_', '');
        const selectedRoleId = values[0];
        const role = guild.roles.cache.get(selectedRoleId);

        if (!role) {
          return interaction.reply({
            content: '❌ Tanlangan rol serverda topilmadi.',
            flags: MessageFlags.Ephemeral
          });
        }

        // 1. @everyone rolini berib bo'lmaydi
        if (role.id === guild.id) {
          return interaction.reply({
            content: '❌ `@everyone` rolini berib bo\'lmaydi!',
            flags: MessageFlags.Ephemeral
          });
        }

        // 2. Bot / tizim integratsiyasi (managed) rollarini berib bo'lmaydi
        if (role.managed) {
          return interaction.reply({
            content: '❌ Ushbu rol bot yoki tizim integratsiyasiga tegishli, uni biriktirib bo\'lmaydi!',
            flags: MessageFlags.Ephemeral
          });
        }

        // 3. Botning eng yuqori roli bilan tekshirish
        const botMember = guild.members.me;
        if (botMember.roles.highest.position <= role.position) {
          return interaction.reply({
            content: `❌ Botning roli (**${botMember.roles.highest.name}**) tanlangan roldan (**${role.name}**) pastda yoki teng! Bot bu rolni bera olmaydi (Server sozlamalarida Bot rolini yuqoriroqqa qo'ying).`,
            flags: MessageFlags.Ephemeral
          });
        }

        // 4. Admin / Moderatorning eng yuqori roli bilan tekshirish (Faqat o'zidan pastdagi rollarni bera olsin)
        const isGuildOwner = guild.ownerId === user.id;
        const isBotOwner = process.env.OWNER_ID && user.id === process.env.OWNER_ID.trim();

        if (!isGuildOwner && !isBotOwner && member.roles.highest.position <= role.position) {
          return interaction.reply({
            content: `❌ Sizning eng yuqori rolingiz (**${member.roles.highest.name}**) ushbu roldan (**${role.name}**) pastda yoki teng! Faqat o'zingizdan pastdagi rollarni bera olasiz.`,
            flags: MessageFlags.Ephemeral
          });
        }

        // Arizachini topish
        const applicant = await guild.members.fetch(applicantId).catch(() => null);
        if (!applicant) {
          return interaction.reply({
            content: '❌ Arizachi ushbu serverda topilmadi (ehtimol serverdan chiqib ketgan).',
            flags: MessageFlags.Ephemeral
          });
        }

        // Arizachida bu rol allaqachon bormi?
        if (applicant.roles.cache.has(role.id)) {
          return interaction.reply({
            content: `⚠️ <@${applicantId}> a'zosida allaqachon **${role.name}** roli mavjud!`,
            flags: MessageFlags.Ephemeral
          });
        }

        try {
          await applicant.roles.add(role, `Ticket orqali berildi (Moderator: ${user.tag})`);

          // Adminga javob
          await interaction.reply({
            content: `✅ Muvaffaqiyatli: <@${applicantId}> a'zosiga <@&${role.id}> roli berildi!`,
            flags: MessageFlags.Ephemeral
          });

          // Ticket kanaliga ochiq e'lon yuborish
          const successEmbed = new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle('🎉 Yangi Rol Biriktirildi!')
            .setDescription(`Admin ${user} tomonidan arizachi <@${applicantId}> ga <@&${role.id}> roli berildi! 🚀`)
            .setTimestamp();

          await interaction.channel.send({ embeds: [successEmbed] });

          // Moderatsiya logiga yozish
          await logger.logModAction(
            guild,
            'Rol Biriktirildi (Ticket)',
            user,
            applicant.user,
            `Berilgan rol: ${role.name} (${role.id})`,
            `Kanal: <#${interaction.channelId}>`
          );
        } catch (err) {
          console.error('Rol berishda xatolik:', err);
          return interaction.reply({
            content: `❌ Rol berishda xatolik yuz berdi: ${err.message}`,
            flags: MessageFlags.Ephemeral
          });
        }
        return;
      }
    }
  }
};
