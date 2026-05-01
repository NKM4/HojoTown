require('dotenv').config();
const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.GUILD_ID;

// プロジェクトルート（botディレクトリの親）
const PROJECT_ROOT = path.resolve(__dirname, '..');
const AFFILIATE_TS_PATH = path.join(PROJECT_ROOT, 'src', 'data', 'affiliate.ts');
const DEPLOY_SCRIPT = path.join(PROJECT_ROOT, 'scripts', 'deploy.sh');

// a8matリンク入力待ちの状態管理
// key: channelId, value: { programName, userId, timestamp, mode: 'update'|'new', targetAdId? }
const pendingA8matInput = new Map();

// 入力待ちのタイムアウト（5分）
const A8MAT_INPUT_TIMEOUT_MS = 5 * 60 * 1000;

function inferAffiliateMetadata(programName) {
  const name = programName.toLowerCase();
  if (/リフォーム|外壁|塗装|住宅|repair|reform/.test(programName) || name.includes('reform')) {
    return {
      categories: "['reform', 'vacant_house']",
      lifeEvents: "['reform']",
      description: '住宅リフォームや修繕を検討している方向けの関連サービスです。補助金の対象工事とあわせて比較できます。',
      conversionType: '無料相談・見積り',
      icon: '🏠',
      priority: 1,
    };
  }
  if (/太陽光|蓄電|省エネ|EV|電気|solar|energy/.test(programName) || name.includes('solar')) {
    return {
      categories: "['solar', 'appliance', 'ev']",
      lifeEvents: "['energy']",
      description: '太陽光・蓄電池・省エネ設備を検討している方向けの関連サービスです。自治体補助金とあわせて確認できます。',
      conversionType: '無料相談・見積り',
      icon: '☀️',
      priority: 1,
    };
  }
  if (/保険|FP|教育|子育て|医療|出産|insurance|school/.test(programName) || name.includes('insurance')) {
    return {
      categories: "['childcare', 'birth', 'medical', 'education']",
      lifeEvents: "['baby', 'career']",
      description: '家計や将来資金を見直したい方向けの関連サービスです。補助金で足りない部分の備えを相談できます。',
      conversionType: '無料相談',
      icon: '🛡️',
      priority: 1,
    };
  }
  if (/引越|移住|不用品|買取|moving/.test(programName) || name.includes('moving')) {
    return {
      categories: "['moving', 'migration']",
      lifeEvents: "['moving']",
      description: '引越しや移住を検討している方向けの関連サービスです。自治体の移住支援とあわせて準備できます。',
      conversionType: '無料相談・見積り',
      icon: '📦',
      priority: 1,
    };
  }
  return {
    categories: "['other']",
    lifeEvents: '',
    description: '補助金や暮らしの手続きを検討している方向けの関連サービスです。条件に合う場合のみ表示されます。',
    conversionType: '無料相談',
    icon: '📌',
    priority: 0,
  };
}

/**
 * affiliate.tsから既存のAFFILIATE_ADS配列を解析し、各広告のid/title/urlを返す
 */
function parseAffiliateAds() {
  const content = fs.readFileSync(AFFILIATE_TS_PATH, 'utf-8');
  const ads = [];
  // 各オブジェクトブロックを正規表現で取得
  const adBlockRegex = /\{\s*\n\s*id:\s*'([^']+)'[\s\S]*?title:\s*'([^']+)'[\s\S]*?url:\s*'([^']+)'[\s\S]*?\}/g;
  let match;
  while ((match = adBlockRegex.exec(content)) !== null) {
    ads.push({ id: match[1], title: match[2], url: match[3] });
  }
  return ads;
}

/**
 * affiliate.tsの指定ad idのurlフィールドを新しいURLに書き換える
 */
function updateAffiliateUrl(adId, newUrl) {
  let content = fs.readFileSync(AFFILIATE_TS_PATH, 'utf-8');

  // id: 'adId' を含むブロック内のurl行を置換
  // ブロックの開始を見つけてからurl行を探す
  const lines = content.split('\n');
  let inTargetBlock = false;
  let braceDepth = 0;
  let modified = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 対象ブロック開始の検出
    if (line.includes(`id: '${adId}'`)) {
      inTargetBlock = true;
      // このブロック開始位置の{を探すため、遡る
      for (let j = i; j >= 0; j--) {
        if (lines[j].trim().startsWith('{')) {
          braceDepth = 1;
          break;
        }
      }
      continue;
    }

    if (inTargetBlock) {
      if (line.includes('{')) braceDepth += (line.match(/\{/g) || []).length;
      if (line.includes('}')) braceDepth -= (line.match(/\}/g) || []).length;

      // urlフィールドを置換
      if (line.match(/^\s*url:\s*'/)) {
        // url行を置換。コメント部分は除去（新しいURLに差し替え済みなのでTODOコメント不要）
        const indent = line.match(/^(\s*)/)[1];
        lines[i] = `${indent}url: '${newUrl}',`;
        modified = true;
        inTargetBlock = false;
        break;
      }

      // ブロック終了
      if (braceDepth <= 0) {
        inTargetBlock = false;
      }
    }
  }

  if (modified) {
    fs.writeFileSync(AFFILIATE_TS_PATH, lines.join('\n'), 'utf-8');
    return true;
  }
  return false;
}

/**
 * deploy.shを実行して結果を返す
 */
function runDeploy() {
  try {
    const output = execSync(`bash "${DEPLOY_SCRIPT}"`, {
      cwd: PROJECT_ROOT,
      timeout: 10 * 60 * 1000, // 10分タイムアウト
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { success: true, output };
  } catch (err) {
    return {
      success: false,
      output: err.stdout || '',
      error: err.stderr || err.message,
    };
  }
}

/**
 * 期限切れの入力待ちを掃除
 */
function cleanupExpiredPending() {
  const now = Date.now();
  for (const [key, val] of pendingA8matInput.entries()) {
    if (now - val.timestamp > A8MAT_INPUT_TIMEOUT_MS) {
      pendingA8matInput.delete(key);
    }
  }
}

// A8.net承認メール検出時に呼ばれる（Webhook経由で受信）
// 承認/スキップボタン付きメッセージを送信
client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  console.log(`Guilds: ${client.guilds.cache.size}`);
});

// ボタン・セレクトメニューのハンドリング
client.on('interactionCreate', async (interaction) => {
  // --- セレクトメニュー: 更新対象の広告選択 ---
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('select_ad_target:')) {
    const programName = interaction.customId.split(':').slice(1).join(':');
    const selectedAdId = interaction.values[0];

    if (selectedAdId === '__new__') {
      // 新規追加モード → a8matリンク入力待ち
      pendingA8matInput.set(interaction.channelId, {
        programName,
        userId: interaction.user.id,
        timestamp: Date.now(),
        mode: 'new',
      });

      await interaction.update({
        embeds: [
          new EmbedBuilder()
            .setTitle('🆕 新規エントリ追加')
            .setDescription(`**${programName}** を新規エントリとして追加します。\n\na8matリンク（\`https://px.a8.net/svt/ejp?a8mat=...\`）をこのチャンネルに貼り付けてください。\n\n⏱️ 5分以内に入力がなければキャンセルされます。`)
            .setColor(0x5865f2)
        ],
        components: [],
      });
    } else {
      // 既存エントリ更新モード → a8matリンク入力待ち
      pendingA8matInput.set(interaction.channelId, {
        programName,
        userId: interaction.user.id,
        timestamp: Date.now(),
        mode: 'update',
        targetAdId: selectedAdId,
      });

      await interaction.update({
        embeds: [
          new EmbedBuilder()
            .setTitle('🔄 URL更新')
            .setDescription(`広告ID \`${selectedAdId}\` のURLを更新します。\n\na8matリンク（\`https://px.a8.net/svt/ejp?a8mat=...\`）をこのチャンネルに貼り付けてください。\n\n⏱️ 5分以内に入力がなければキャンセルされます。`)
            .setColor(0x5865f2)
        ],
        components: [],
      });
    }
    return;
  }

  if (!interaction.isButton()) return;

  const [action, ...rest] = interaction.customId.split(':');
  const programId = rest.join(':');

  if (action === 'approve_affiliate') {
    // 既存の広告リストを取得してセレクトメニューを構築
    let ads;
    try {
      ads = parseAffiliateAds();
    } catch (err) {
      await interaction.update({
        embeds: [
          new EmbedBuilder()
            .setTitle('❌ エラー')
            .setDescription(`affiliate.tsの読み込みに失敗しました。\n\`\`\`${err.message}\`\`\``)
            .setColor(0xe74c3c)
        ],
        components: [],
      });
      return;
    }

    // セレクトメニューの選択肢（既存広告 + 新規追加）
    const options = ads.map(ad => ({
      label: `${ad.id}`,
      description: ad.title.substring(0, 100),
      value: ad.id,
    }));
    // 25個制限があるので先頭25個まで（discord.jsの制限）
    const menuOptions = options.slice(0, 24);
    menuOptions.push({
      label: '🆕 新規エントリとして追加',
      description: '既存のどの広告にも該当しない場合',
      value: '__new__',
    });

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`select_ad_target:${programId}`)
      .setPlaceholder('更新する広告を選択...')
      .addOptions(menuOptions);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.update({
      embeds: [
        new EmbedBuilder()
          .setTitle('✅ 承認済み')
          .setDescription(`**${programId}** の追加を承認しました。\n\nどの広告エントリを更新しますか？`)
          .setColor(0x1a5c3a)
          .setTimestamp()
      ],
      components: [row],
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

  } else if (action === 'confirm_deploy') {
    // デプロイ確認ボタン
    await interaction.update({
      embeds: [
        new EmbedBuilder()
          .setTitle('🚀 デプロイ開始')
          .setDescription('deploy.shを実行中... しばらくお待ちください。')
          .setColor(0x5865f2)
      ],
      components: [],
    });

    const channel = interaction.channel;
    const result = runDeploy();

    if (result.success) {
      await channel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle('🎉 デプロイ完了')
            .setDescription('ビルド・デプロイが正常に完了しました。')
            .setColor(0x1a5c3a)
            .setTimestamp()
        ],
      });
    } else {
      // 出力の末尾500文字だけ表示（長すぎるとembedに入らない）
      const errorSnippet = (result.error || result.output || 'unknown error').slice(-500);
      await channel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle('❌ デプロイ失敗')
            .setDescription(`deploy.shの実行に失敗しました。手動で確認してください。\n\`\`\`\n${errorSnippet}\n\`\`\``)
            .setColor(0xe74c3c)
        ],
      });
    }

  } else if (action === 'skip_deploy') {
    await interaction.update({
      embeds: [
        new EmbedBuilder()
          .setTitle('⏭️ デプロイスキップ')
          .setDescription('affiliate.tsは更新済みです。手動でデプロイしてください。\n`bash scripts/deploy.sh`')
          .setColor(0x999999)
      ],
      components: [],
    });
  }
});

// メッセージ監視（Webhook経由のメール通知を検出 + a8matリンク入力受付）
client.on('messageCreate', async (message) => {
  // BOT自身のメッセージは無視
  if (message.author.id === client.user.id) return;

  // --- a8matリンク入力待ちの処理 ---
  cleanupExpiredPending();
  const pending = pendingA8matInput.get(message.channelId);
  if (pending && message.author.id === pending.userId) {
    const content = message.content.trim();

    // a8matリンクの検証
    const a8matUrlMatch = content.match(/(https:\/\/px\.a8\.net\/svt\/ejp\?a8mat=[A-Za-z0-9+]+)/);
    if (a8matUrlMatch) {
      const newUrl = a8matUrlMatch[1];
      pendingA8matInput.delete(message.channelId);

      if (pending.mode === 'update' && pending.targetAdId) {
        // --- 既存エントリのURL更新 ---
        try {
          const updated = updateAffiliateUrl(pending.targetAdId, newUrl);
          if (updated) {
            // 更新成功 → デプロイ確認
            const deployRow = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId('confirm_deploy:auto')
                .setLabel('🚀 ビルド+デプロイ実行')
                .setStyle(ButtonStyle.Primary),
              new ButtonBuilder()
                .setCustomId('skip_deploy:auto')
                .setLabel('⏭️ あとでデプロイ')
                .setStyle(ButtonStyle.Secondary),
            );

            await message.reply({
              embeds: [
                new EmbedBuilder()
                  .setTitle('✅ affiliate.ts更新完了')
                  .setDescription(`広告ID \`${pending.targetAdId}\` のURLを更新しました。\n\n**新URL:** \`${newUrl}\`\n\nデプロイしますか？`)
                  .setColor(0x1a5c3a)
              ],
              components: [deployRow],
            });
          } else {
            await message.reply({
              embeds: [
                new EmbedBuilder()
                  .setTitle('❌ 更新失敗')
                  .setDescription(`広告ID \`${pending.targetAdId}\` のurl行がaffiliate.tsに見つかりませんでした。手動で確認してください。`)
                  .setColor(0xe74c3c)
              ],
            });
          }
        } catch (err) {
          await message.reply({
            embeds: [
              new EmbedBuilder()
                .setTitle('❌ ファイル編集エラー')
                .setDescription(`affiliate.tsの編集中にエラーが発生しました。\n\`\`\`${err.message}\`\`\``)
                .setColor(0xe74c3c)
            ],
          });
        }

      } else if (pending.mode === 'new') {
        // --- 新規エントリ追加（最低限のテンプレート） ---
        // プログラム名からidを生成（英数字+ハイフン）
        const safeId = pending.programName
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '-')
          .toLowerCase()
          .substring(0, 30) || 'new-affiliate';
        const metadata = inferAffiliateMetadata(pending.programName);
        const lifeEventsLine = metadata.lifeEvents ? `\n    lifeEvents: ${metadata.lifeEvents},` : '';

        const newEntry = `
  // ${pending.programName}（自動追加 ${new Date().toISOString().split('T')[0]}）
  {
    id: '${safeId}',
    triggerCategories: ${metadata.categories},${lifeEventsLine}
    title: '${pending.programName.replace(/'/g, "\\'")}',
    description: '${metadata.description}',
    ctaText: '詳しく見る',
    url: '${newUrl}',
    label: 'PR',
    icon: '${metadata.icon}',
    conversionType: '${metadata.conversionType}',
    priority: ${metadata.priority},
  },`;

        try {
          let content = fs.readFileSync(AFFILIATE_TS_PATH, 'utf-8');
          // AFFILIATE_ADS配列の最後の要素の後（閉じ];の前）に挿入
          const insertPoint = content.lastIndexOf('];');
          if (insertPoint === -1) {
            throw new Error('AFFILIATE_ADS配列の終端が見つかりません');
          }
          content = content.substring(0, insertPoint) + newEntry + '\n' + content.substring(insertPoint);
          fs.writeFileSync(AFFILIATE_TS_PATH, content, 'utf-8');

          const deployRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('confirm_deploy:auto')
              .setLabel('🚀 ビルド+デプロイ実行')
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId('skip_deploy:auto')
              .setLabel('⏭️ あとでデプロイ')
              .setStyle(ButtonStyle.Secondary),
          );

          await message.reply({
            embeds: [
              new EmbedBuilder()
                .setTitle('✅ 新規エントリ追加完了')
                .setDescription(`**${pending.programName}** をaffiliate.tsに追加しました。\n\n**ID:** \`${safeId}\`\n**URL:** \`${newUrl}\`\n\nカテゴリ・説明文・成約条件はプログラム名から仮設定済みです。必要に応じて後で微調整してください。\n\nデプロイしますか？`)
                .setColor(0x1a5c3a)
            ],
            components: [deployRow],
          });
        } catch (err) {
          await message.reply({
            embeds: [
              new EmbedBuilder()
                .setTitle('❌ ファイル編集エラー')
                .setDescription(`affiliate.tsへの新規追加中にエラーが発生しました。\n\`\`\`${err.message}\`\`\``)
                .setColor(0xe74c3c)
            ],
          });
        }
      }
      return; // a8matリンク処理完了、以降のメッセージ処理をスキップ
    }

    // a8matリンクっぽくないメッセージ → 「キャンセル」チェック
    if (content === 'cancel' || content === 'キャンセル') {
      pendingA8matInput.delete(message.channelId);
      await message.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('🚫 キャンセル')
            .setDescription('a8matリンクの入力をキャンセルしました。')
            .setColor(0x999999)
        ],
      });
      return;
    }

    // a8matリンクではないが入力待ち中 → ヒント表示
    if (content.includes('a8.net') || content.includes('a8mat')) {
      await message.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('⚠️ URLの形式を確認してください')
            .setDescription('a8matリンクは `https://px.a8.net/svt/ejp?a8mat=...` の形式です。\nA8.netの広告リンク作成ページからコピーしてください。\n\nキャンセルする場合は「キャンセル」と入力してください。')
            .setColor(0xc8a84b)
        ],
      });
      return;
    }
    // 入力待ち中だがa8関係ない通常メッセージ → 無視して通常処理へ
  }

  // --- Webhook経由のA8.net承認通知を検出 ---
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
