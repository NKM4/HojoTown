/**
 * 週次レポート: サイト統計をDiscord Webhookに送信
 *
 * 環境変数:
 *   WEBHOOK_ACCESS - Discord Webhook URL (#アクセスチャンネル)
 *   WEBHOOK_CLICKS - Discord Webhook URL (#成果報酬チャンネル)
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const WEBHOOK_ACCESS = process.env.WEBHOOK_ACCESS;
const WEBHOOK_CLICKS = process.env.WEBHOOK_CLICKS;

if (!WEBHOOK_ACCESS) {
  console.error('WEBHOOK_ACCESS 環境変数が未設定');
  process.exit(1);
}

// --- 統計収集 ---

const distDir = path.join(__dirname, '..', 'dist');
const dataDir = path.join(__dirname, '..', 'src', 'data');
const subsidiesDir = path.join(dataDir, 'subsidies');

// 1. dist内の全HTMLページ数
function countPages() {
  let count = 0;
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name === 'index.html') {
        count++;
      }
    }
  }
  walk(distDir);
  return count;
}

// 2. 対応市区町村数（subsidies JSONファイル数）
function countCities() {
  if (!fs.existsSync(subsidiesDir)) return 0;
  return fs.readdirSync(subsidiesDir).filter(f => f.endsWith('.json')).length;
}

// 3. 全補助金件数
function countSubsidies() {
  if (!fs.existsSync(subsidiesDir)) return 0;
  let total = 0;
  for (const file of fs.readdirSync(subsidiesDir).filter(f => f.endsWith('.json'))) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(subsidiesDir, file), 'utf-8'));
      if (Array.isArray(data)) {
        total += data.length;
      } else if (data.subsidies && Array.isArray(data.subsidies)) {
        total += data.subsidies.length;
      }
    } catch (_) {}
  }
  return total;
}

// 4. 最終更新日（dist内の最新ファイル更新日）
function getLastModified() {
  let latest = 0;
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== '_astro') {
        walk(full);
      } else if (entry.name === 'index.html') {
        const stat = fs.statSync(full);
        if (stat.mtimeMs > latest) latest = stat.mtimeMs;
      }
    }
  }
  walk(distDir);
  return latest ? new Date(latest).toISOString().split('T')[0] : '不明';
}

// 5. affiliate.ts からアフィリエイトプログラム数をカウント
function countAffiliatePrograms() {
  const affiliatePath = path.join(dataDir, 'affiliate.ts');
  if (!fs.existsSync(affiliatePath)) return 0;
  const content = fs.readFileSync(affiliatePath, 'utf-8');
  // programId の出現数をカウント
  const matches = content.match(/programId/g);
  return matches ? matches.length : 0;
}

// --- Discord送信 ---

function sendWebhook(webhookUrl, payload) {
  return new Promise((resolve, reject) => {
    const url = new URL(webhookUrl);
    const postData = JSON.stringify(payload);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(body);
        } else {
          reject(new Error(`Discord webhook failed: ${res.statusCode} ${body}`));
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function main() {
  const pages = countPages();
  const cities = countCities();
  const subsidies = countSubsidies();
  const lastModified = getLastModified();
  const affiliatePrograms = countAffiliatePrograms();

  const now = new Date().toISOString();
  const weekOf = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });

  // アクセスレポート（サイト統計）
  const accessEmbed = {
    title: `週次レポート (${weekOf})`,
    color: 0x1a5c3a,
    fields: [
      { name: 'HTMLページ数', value: `${pages}`, inline: true },
      { name: '対応市区町村数', value: `${cities}`, inline: true },
      { name: '補助金掲載件数', value: `${subsidies}`, inline: true },
      { name: 'アフィリエイトプログラム数', value: `${affiliatePrograms}`, inline: true },
      { name: '最終ビルド日', value: lastModified, inline: true },
    ],
    footer: { text: 'GitHub Actions 自動レポート' },
    timestamp: now,
  };

  console.log('=== 週次レポート ===');
  console.log(`ページ数: ${pages}`);
  console.log(`対応市区町村: ${cities}`);
  console.log(`補助金件数: ${subsidies}`);
  console.log(`アフィリエイト: ${affiliatePrograms}件`);
  console.log(`最終ビルド: ${lastModified}`);

  await sendWebhook(WEBHOOK_ACCESS, { embeds: [accessEmbed] });
  console.log('Discord (#アクセス) に送信完了');

  // 成果報酬チャンネルにもサマリー送信（クリック数はGA4連携後に追加予定）
  if (WEBHOOK_CLICKS) {
    const clicksEmbed = {
      title: `A8.net 週次サマリー (${weekOf})`,
      color: 0xc8a84b,
      description: 'アフィリエイトリンクのクリック追跡は GA4 連携後に有効化予定です。',
      fields: [
        { name: 'アフィリエイトプログラム数', value: `${affiliatePrograms}`, inline: true },
        { name: '対応市区町村数', value: `${cities}`, inline: true },
      ],
      footer: { text: 'GitHub Actions 自動レポート' },
      timestamp: now,
    };
    await sendWebhook(WEBHOOK_CLICKS, { embeds: [clicksEmbed] });
    console.log('Discord (#成果報酬) に送信完了');
  }
}

main().catch((e) => {
  console.error('レポート送信失敗:', e.message);
  process.exit(1);
});
