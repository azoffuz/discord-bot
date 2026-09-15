const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder, MessageFlags } = require('discord.js');
const storage = require('../../config/storage');
const { updateGuildStats } = require('../../utils/statsUpdater');
const log = require('../../utils/log');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set-stats')
    .setDescription('Server a\'zolari, boosterlar, online va ovozli hisoblagich kanallarini sozlash')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option
        .setName('status')
        .setDescription('Server statistikasini yoqish, o\'chirish yoki yangilash')
        .setRequired(false)
        .addChoices(
          { name: '✅ Yoqish (Statistika kanallarini ochish)', value: 'enable' },
          { name: '❌ O\'chirish (Statistika kanallarini olib tashlash)', value: 'disable' },
          { name: '🔄 Yangilash (Hisoblagichlarni darhol yangilash)', value: 'refresh' }
        )
    )
    .addStringOption(option =>
      option
        .setName('external_category_id')
        .setDescription('Boshqa serveringizdagi kategoriya ID si (Serverlararo stats uchun)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('external_guild_id')
        .setDescription('Boshqa serveringiz ID si (Bot u yerda avtomat kategoriya ochishi uchun)')
        .setRequired(false)
    )
    .addChannelOption(option =>
      option
        .setName('category')
        .setDescription('O\'z serveringizdagi mavjud kategoriya (ixtiyoriy)')
        .addChannelTypes(ChannelType.GuildCategory)
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

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const statusChoice = interaction.options.getString('status');
    const extCategoryId = interaction.options.getString('external_category_id');
    const extGuildId = interaction.options.getString('external_guild_id');
    const localCategory = interaction.options.getChannel('category');
    const guild = interaction.guild;
    const settings = storage.getGuildSettings(guild.id);

    // 1. STATUS VA MA'LUMOT KO'RISH (Parametrlar berilmaganda)
    if (!statusChoice && !extCategoryId && !extGuildId && !localCategory) {
      const stats = settings.stats;
      if (!stats || !stats.enabled) {
        const infoEmbed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle('📊 Server Statistikasi Tizimi')
          .setDescription(
            'Server statistikasi a\'zolar, onlaynlar, botlar, boosterlar va ovozli xonalardagi odamlar sonini jonli ovozli hisoblagich kanallarida ko\'rsatib turadi.\n\n' +
            '**Holati:** ❌ O\'chirilgan\n\n' +
            '**Buyruqdan foydalanish:**\n' +
            '• `/set-stats status:enable` — O\'z serveringizda yangi kategoriya va 6 ta kanal ochadi.\n' +
            '• `/set-stats status:enable external_category_id:[ID]` — Boshqa serveringizdagi kategoriya ichida ochadi.\n' +
            '• `/set-stats status:enable external_guild_id:[ID]` — Boshqa serveringizda avtomat kategoriya va kanallarni ochadi.\n' +
            '• `/set-stats status:disable` — Barcha stats kanallarini olib tashlaydi.\n' +
            '• `/set-stats status:refresh` — Hisoblagichlarni darhol qayta yangilaydi.'
          )
          .setFooter({ text: 'Cleva Server Stats' })
          .setTimestamp();
        return interaction.editReply({ embeds: [infoEmbed] });
      }

      const targetGuildName = stats.isExternal ? (stats.targetGuildName || '2-Server') : guild.name;
      const statusEmbed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('📊 Server Statistikasi Holati')
        .setDescription(
          `**Holati:** ✅ Faol\n` +
          `**Joylashuvi:** ${stats.isExternal ? `🌐 Boshqa serverda (**${targetGuildName}**)` : `🏠 Shu serverda`}\n` +
          (stats.categoryId ? `**Kategoriya:** <#${stats.categoryId}>\n\n` : '\n') +
          `**Hisoblagich Kanallari:**\n` +
          (stats.totalChannelId ? `• 👥 **Jami:** <#${stats.totalChannelId}>\n` : '') +
          (stats.membersChannelId ? `• 👤 **A'zolar:** <#${stats.membersChannelId}>\n` : '') +
          (stats.botsChannelId ? `• 🤖 **Botlar:** <#${stats.botsChannelId}>\n` : '') +
          (stats.onlineChannelId ? `• 🟢 **Onlayn:** <#${stats.onlineChannelId}>\n` : '') +
          (stats.boostersChannelId ? `• 🚀 **Boosterlar:** <#${stats.boostersChannelId}>\n` : '') +
          (stats.voiceChannelId ? `• 🎙️ **Ovozdagilar:** <#${stats.voiceChannelId}>\n` : '') +
          `\n🔄 *Yangilash uchun:* \`/set-stats status:refresh\`\n` +
          `❌ *O'chirish uchun:* \`/set-stats status:disable\``
        )
        .setTimestamp();
      return interaction.editReply({ embeds: [statusEmbed] });
    }

    // 2. DARHOL YANGILASH (REFRESH)
    if (statusChoice === 'refresh') {
      if (!settings.stats || !settings.stats.enabled) {
        return interaction.editReply({
          content: '❌ Server statistikasi hali yoqilmagan. Avval yoqing: `/set-stats status:enable`'
        });
      }
      await updateGuildStats(guild, true);
      const refreshEmbed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('🔄 Statistika Yangilandi!')
        .setDescription('Barcha hisoblagich kanallari eng so\'nggi server ma\'lumotlari bilan darhol yangilandi.')
        .setTimestamp();
      return interaction.editReply({ embeds: [refreshEmbed] });
    }

    // 3. STATISTIKANI O'CHIRISH (DISABLE)
    if (statusChoice === 'disable') {
      if (!settings.stats || !settings.stats.enabled) {
        return interaction.editReply({
          content: 'ℹ️ Server statistikasi allaqachon o\'chirilgan holatda.'
        });
      }

      const {
        totalChannelId,
        membersChannelId,
        botsChannelId,
        onlineChannelId,
        boostersChannelId,
        voiceChannelId,
        categoryId,
        createdCategory
      } = settings.stats;

      const channelIdsToDelete = [
        totalChannelId,
        membersChannelId,
        botsChannelId,
        onlineChannelId,
        boostersChannelId,
        voiceChannelId
      ].filter(Boolean);

      for (const chId of channelIdsToDelete) {
        const ch = guild.client.channels.cache.get(chId) || await guild.client.channels.fetch(chId).catch(() => null);
        if (ch) await ch.delete().catch(() => {});
      }

      if (categoryId && createdCategory !== false) {
        const cat = guild.client.channels.cache.get(categoryId) || await guild.client.channels.fetch(categoryId).catch(() => null);
        if (cat) await cat.delete().catch(() => {});
      }

      storage.updateGuildSettings(guild.id, {
        stats: {
          enabled: false,
          categoryId: null,
          totalChannelId: null,
          membersChannelId: null,
          botsChannelId: null,
          onlineChannelId: null,
          boostersChannelId: null,
          voiceChannelId: null
        }
      });

      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('📊 Server Statistikasi O\'chirildi')
        .setDescription('Server statistikasi kanallari va hisoblagichlari to\'liq olib tashlandi.')
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    // 4. STATISTIKANI YOQISH (ENABLE)
    try {
      let targetGuild = guild;
      let targetCategory = null;
      let createdCategory = false;
      let isExternal = false;

      // Kategoriya va serverni aniqlash
      if (extCategoryId) {
        const ch = guild.client.channels.cache.get(extCategoryId) || await guild.client.channels.fetch(extCategoryId).catch(() => null);
        if (!ch || ch.type !== ChannelType.GuildCategory) {
          return interaction.editReply({
            content: '❌ Ko\'rsatilgan `external_category_id` topilmadi yoki bu kategoriya emas. ID ni to\'g\'ri nusxalaganligingizga ishonch hosil qiling.'
          });
        }
        targetCategory = ch;
        targetGuild = ch.guild;
        isExternal = targetGuild.id !== guild.id;
        createdCategory = false;
      } else if (extGuildId) {
        const g = guild.client.guilds.cache.get(extGuildId) || await guild.client.guilds.fetch(extGuildId).catch(() => null);
        if (!g) {
          return interaction.editReply({
            content: '❌ Ko\'rsatilgan `external_guild_id` bo\'yicha 2-server topilmadi. Bot ushbu serverga qo\'shilganligiga ishonch hosil qiling.'
          });
        }
        targetGuild = g;
        isExternal = targetGuild.id !== guild.id;

        const meInTarget = targetGuild.members.me || await targetGuild.members.fetchMe().catch(() => null);
        if (!meInTarget || !meInTarget.permissions.has(PermissionFlagsBits.ManageChannels)) {
          return interaction.editReply({
            content: `❌ Botda **${targetGuild.name}** serverida kanallarni boshqarish (\`Manage Channels\`) ruxsati yetarli emas.`
          });
        }

        targetCategory = await targetGuild.channels.create({
          name: `📊・${guild.name.slice(0, 20)} STATS`,
          type: ChannelType.GuildCategory,
          position: 0,
          permissionOverwrites: [
            {
              id: targetGuild.id,
              deny: [PermissionFlagsBits.Connect],
              allow: [PermissionFlagsBits.ViewChannel]
            },
            {
              id: guild.client.user.id,
              allow: [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ViewChannel]
            }
          ]
        });
        createdCategory = true;
      } else if (localCategory) {
        targetCategory = localCategory;
        createdCategory = false;
      } else {
        const me = guild.members.me || await guild.members.fetchMe().catch(() => null);
        if (!me || !me.permissions.has(PermissionFlagsBits.ManageChannels)) {
          return interaction.editReply({
            content: '❌ Botda ushbu serverda kanallarni boshqarish (`Manage Channels`) ruxsati yetarli emas.'
          });
        }

        targetCategory = await guild.channels.create({
          name: '📊・SERVER STATISTIKASI',
          type: ChannelType.GuildCategory,
          position: 0,
          permissionOverwrites: [
            {
              id: guild.id,
              deny: [PermissionFlagsBits.Connect],
              allow: [PermissionFlagsBits.ViewChannel]
            },
            {
              id: guild.client.user.id,
              allow: [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ViewChannel]
            }
          ]
        });
        createdCategory = true;
      }

      // Ruxsatlarni tekshirish
      const meInTarget = targetGuild.members.me || await targetGuild.members.fetchMe().catch(() => null);
      if (!meInTarget || !meInTarget.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return interaction.editReply({
          content: `❌ Botda **${targetGuild.name}** serverida kanallarni boshqarish (\`Manage Channels\`) ruxsati yetarli emas.`
        });
      }

      // Eski stats kanallari bo'lsa ularni tozalash (orphaned kanallar qolmasligi uchun)
      if (settings.stats && settings.stats.enabled) {
        const oldChannels = [
          settings.stats.totalChannelId,
          settings.stats.membersChannelId,
          settings.stats.botsChannelId,
          settings.stats.onlineChannelId,
          settings.stats.boostersChannelId,
          settings.stats.voiceChannelId
        ].filter(Boolean);

        for (const oldId of oldChannels) {
          const ch = guild.client.channels.cache.get(oldId) || await guild.client.channels.fetch(oldId).catch(() => null);
          if (ch) await ch.delete().catch(() => {});
        }

        if (createdCategory && settings.stats.categoryId && settings.stats.createdCategory !== false && settings.stats.categoryId !== targetCategory.id) {
          const oldCat = guild.client.channels.cache.get(settings.stats.categoryId) || await guild.client.channels.fetch(settings.stats.categoryId).catch(() => null);
          if (oldCat) await oldCat.delete().catch(() => {});
        }
      }

      // Ma'lumotlarni yig'ish
      await guild.members.fetch().catch(() => {});
      const fetchedGuild = await guild.fetch().catch(() => guild);

      const total = guild.memberCount || guild.members.cache.size;
      const bots = guild.members.cache.filter(m => m.user.bot).size;
      const humans = Math.max(0, total - bots);
      const online = fetchedGuild.approximatePresenceCount ?? guild.members.cache.filter(m => m.presence && m.presence.status !== 'offline').size;
      const boosters = guild.members.cache.filter(m => m.premiumSince !== null).size;
      const boosts = guild.premiumSubscriptionCount || 0;
      const voice = guild.voiceStates.cache.filter(vs => vs.channelId).size;

      const permissionOverwrites = [
        {
          id: targetGuild.id, // @everyone
          deny: [PermissionFlagsBits.Connect], // Faqat ko'rish, ulanish taqiqlanadi
          allow: [PermissionFlagsBits.ViewChannel]
        },
        {
          id: guild.client.user.id,
          allow: [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ViewChannel]
        }
      ];

      // 1. Jami a'zolar
      const totalChannel = await targetGuild.channels.create({
        name: `👥・Jami A'zolar: ${total}`,
        type: ChannelType.GuildVoice,
        parent: targetCategory.id,
        permissionOverwrites
      });

      // 2. Oddiy a'zolar
      const membersChannel = await targetGuild.channels.create({
        name: `👤・A'zolar: ${humans}`,
        type: ChannelType.GuildVoice,
        parent: targetCategory.id,
        permissionOverwrites
      });

      // 3. Botlar
      const botsChannel = await targetGuild.channels.create({
        name: `🤖・Botlar: ${bots}`,
        type: ChannelType.GuildVoice,
        parent: targetCategory.id,
        permissionOverwrites
      });

      // 4. Onlayn a'zolar
      const onlineChannel = await targetGuild.channels.create({
        name: `🟢・Onlayn: ${online}`,
        type: ChannelType.GuildVoice,
        parent: targetCategory.id,
        permissionOverwrites
      });

      // 5. Boosterlar
      const boostersChannel = await targetGuild.channels.create({
        name: `🚀・Boosterlar: ${boosters}`,
        type: ChannelType.GuildVoice,
        parent: targetCategory.id,
        permissionOverwrites
      });

      // 6. Ovozdagilar
      const voiceChannel = await targetGuild.channels.create({
        name: `🎙️・Ovozdagilar: ${voice}`,
        type: ChannelType.GuildVoice,
        parent: targetCategory.id,
        permissionOverwrites
      });

      storage.updateGuildSettings(guild.id, {
        stats: {
          enabled: true,
          isExternal,
          targetGuildId: targetGuild.id,
          targetGuildName: targetGuild.name,
          categoryId: targetCategory.id,
          createdCategory,
          totalChannelId: totalChannel.id,
          membersChannelId: membersChannel.id,
          botsChannelId: botsChannel.id,
          onlineChannelId: onlineChannel.id,
          boostersChannelId: boostersChannel.id,
          voiceChannelId: voiceChannel.id
        }
      });

      const successEmbed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('📊 Server Statistikasi Yoqildi!')
        .setDescription(
          '**Server statistikasi kategoriyasi va 6 ta hisoblagich kanallari muvaffaqiyatli yaratildi!**\n\n' +
          (isExternal ? `🌐 **Joylashuvi:** **${targetGuild.name}** serverida (Serverlararo rejim)\n` : '') +
          `📁 **Kategoriya:** ${targetCategory.name}\n\n` +
          `• 👥 **Jami A'zolar:** <#${totalChannel.id}> (${total})\n` +
          `• 👤 **Oddiy A'zolar:** <#${membersChannel.id}> (${humans})\n` +
          `• 🤖 **Botlar:** <#${botsChannel.id}> (${bots})\n` +
          `• 🟢 **Onlayn:** <#${onlineChannel.id}> (${online})\n` +
          `• 🚀 **Boosterlar:** <#${boostersChannel.id}> (${boosters} ta a'zo / ${boosts} boost)\n` +
          `• 🎙️ **Ovozdagilar:** <#${voiceChannel.id}> (${voice})\n\n` +
          '⏰ *Ushbu kanallar har 10 daqiqada hamda a\'zolar kirib-chiqqanda avtomatik yangilanadi.*'
        )
        .setFooter({ text: 'Yangilash: /set-stats status:refresh • O\'chirish: /set-stats status:disable' })
        .setTimestamp();

      return interaction.editReply({ embeds: [successEmbed] });
    } catch (err) {
      log.error('[SET-STATS XATOSI]:', err);
      return interaction.editReply({
        content: `❌ Statistikani sozlashda xatolik yuz berdi: ${err.message}`
      });
    }
  }
};
