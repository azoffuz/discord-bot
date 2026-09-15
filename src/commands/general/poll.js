const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const NUMBER_EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('poll')
    .setDescription('Server a\'zolari uchun so\'rovnoma (ovoz berish) tashkil qiladi')
    .setDMPermission(false)
    .addStringOption(option =>
      option.setName('question')
        .setDescription('So\'rovnoma savoli')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('option1')
        .setDescription('1-variant')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('option2')
        .setDescription('2-variant')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('option3')
        .setDescription('3-variant (ixtiyoriy)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('option4')
        .setDescription('4-variant (ixtiyoriy)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('option5')
        .setDescription('5-variant (ixtiyoriy)')
        .setRequired(false)
    ),

  async execute(interaction) {
    const question = interaction.options.getString('question');
    const options = [
      interaction.options.getString('option1'),
      interaction.options.getString('option2'),
      interaction.options.getString('option3'),
      interaction.options.getString('option4'),
      interaction.options.getString('option5')
    ].filter(opt => Boolean(opt));

    const description = options
      .map((opt, index) => `${NUMBER_EMOJIS[index]} **${opt}**`)
      .join('\n\n');

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`📊 So'rovnoma: ${question}`)
      .setDescription(description)
      .setFooter({ text: `Tashkilotchi: ${interaction.user.tag} • Ovoz berish uchun pastdagi emojilarni bosing` })
      .setTimestamp();

    await interaction.reply({
      content: '✅ So\'rovnoma yaratilmoqda...',
      ephemeral: true
    });

    const pollMessage = await interaction.channel.send({ embeds: [embed] });

    for (let i = 0; i < options.length; i++) {
      await pollMessage.react(NUMBER_EMOJIS[i]).catch(() => {});
    }

    await interaction.editReply({
      content: '✅ So\'rovnoma muvaffaqiyatli joylashtirildi!'
    });
  }
};
