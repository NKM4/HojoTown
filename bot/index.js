require('dotenv').config();
const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.GUILD_ID;

// A8.net承認メール検出時に呼ばれる（Webhook経由で受信）
// 承認/スキップボタン付きメッセージを送信
client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  console.log(`Guilds: ${client.guilds.cache.size}`);
});

// ボタン操作のハンドリング
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  const [action, programId] = interaction.customId.split(':');

  if (action === 'approve_affiliate') {
    await interaction.update({
      embeds: [
        new EmbedBuilder()
          .setTitle('✅ 承認済み')
          .setDescription(`プログラム ${programId} の追加を承認しました。\naffiliate.tsへの追加処理を開始します...`)
          .setColor(0x1a5c3a)
          .setTimestamp()
      ],
      components: [],
    });

    // TODO: ここでa8matコード取得→affiliate.ts編集→ビルド→デプロイの自動処理
    // 現時点では通知のみ
    const channel = interaction.channel;
    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle('📝 手動対応が必要')
          .setDescription(`プログラム ${programId} のa8matコードを取得してaffiliate.tsに追加してください。\n\`bash scripts/deploy.sh\` でデプロイ。`)
          .setColor(0xc8a84b)
      ]
    });

  } else if (action === 'skip_affiliate') {
    await interaction.update({
      embeds: [
        new EmbedBuilder()
          .setTitle('⏭️ スキップ')
          .setDescription(`プログラム ${programId} をスキップしました。`)
          .setColor(0x999999)
          .setTimestamp()
      ],
      components: [],
    });
  }
});

// メッセージ監視（Webhook経由のメール通知を検出して承認ボタンを追加）
client.on('messageCreate', async (message) => {
  // BOT自身のメッセージは無視
  if (message.author.id === client.user.id) return;

  // Webhook経由のA8.net承認通知を検出
  if (message.webhookId && message.embeds.length > 0) {
    const embed = message.embeds[0];
    const title = embed.title || '';

    // A8.net承認メールの通知を検出
    if (title.includes('A8.net') && (title.includes('承認') || embed.description?.includes('承認'))) {
      // 承認/スキップボタンを追加
      const fields = embed.fields || [];
      const programName = fields.find(f => f.name.includes('承認'))?.value || title;

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`approve_affiliate:${programName.substring(0, 50)}`)
          .setLabel('✅ affiliate.tsに追加')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`skip_affiliate:${programName.substring(0, 50)}`)
          .setLabel('❌ スキップ')
          .setStyle(ButtonStyle.Danger),
      );

      await message.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('🔔 新規A8.net提携承認')
            .setDescription(`**${programName}**\n\naffiliate.tsに追加しますか？`)
            .setColor(0xc8a84b)
        ],
        components: [row],
      });
    }
  }
});

// !health コマンド
client.on('messageCreate', async (message) => {
  if (message.content === '!health') {
    const uptime = Math.floor(process.uptime());
    const hours = Math.floor(uptime / 3600);
    const mins = Math.floor((uptime % 3600) / 60);
    await message.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('🏥 HojoTown Bot Status')
          .setColor(0x1a5c3a)
          .addFields(
            { name: 'Status', value: '✅ Online', inline: true },
            { name: 'Uptime', value: `${hours}h ${mins}m`, inline: true },
            { name: 'Guilds', value: `${client.guilds.cache.size}`, inline: true },
          )
          .setTimestamp()
      ]
    });
  }
});

client.login(TOKEN);
