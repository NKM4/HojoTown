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
const GA4_PROPERTY_ID = '531123324';

if (!WEBHOOK_ACCESS) {
  console.error('WEBHOOK_ACCESS 環境変数が未設定');
  process.exit(1);
}

// --- 統計収集 ---

const distDir = path.join(__dirname, '..', 'dist');
const dataDir = path.join(__dirname, '..', 'src', 'data');
const subsidiesDir = path.join(dataDir, 'subsidies');

// 1. src/pages内の全.astroファイル数
function countPages() {
  const pagesDir = path.join(__dirname, '..', 'src', 'pages');
  let count = 0;
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.astro')) count++;
    }
  }
  walk(pagesDir);
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

// 4. 最終更新日（subsidiesディレクトリの最新ファイル）
function getLastModified() {
  if (!fs.existsSync(subsidiesDir)) return '不明';
  let latest = 0;
  for (const f of fs.readdirSync(subsidiesDir)) {
    const stat = fs.statSync(path.join(subsidiesDir, f));
    if (stat.mtimeMs > latest) latest = stat.mtimeMs;
  }
  return latest ? new Date(latest).toISOString().split('T')[0] : '不明';
}

// 5. affiliate.ts からアフィリエイトプログラム数をカウント
function countAffiliatePrograms() {
  const affiliatePath = path.join(dataDir, 'affiliate.ts');
  if (!fs.existsSync(affiliatePath)) return 0;
  const content = fs.readFileSync(affiliatePath, 'utf-8');
  // programId の出現数をカウント
  const matches = content.match(/a8mat=/g);
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

// GA4 Data API - affiliate_click集計
async function getGA4AffiliateClicks() {
  try {
    // サービスアカウントキーがある場合のみ実行
    const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!keyPath && !process.env.GA4_SERVICE_ACCOUNT_KEY) return null;

    // 環境変数からキーを書き出す（GitHub Actions用）
    if (process.env.GA4_SERVICE_ACCOUNT_KEY && !keyPath) {
      const tmpKey = path.join(__dirname, '..', '.ga4-tmp-key.json');
      fs.writeFileSync(tmpKey, process.env.GA4_SERVICE_ACCOUNT_KEY);
      process.env.GOOGLE_APPLICATION_CREDENTIALS = tmpKey;
    }

    const { BetaAnalyticsDataClient } = require('@google-analytics/data');
    const client = new BetaAnalyticsDataClient();

    // affiliate_click total
    const [clickResponse] = await client.runReport({
      property: `properties/${GA4_PROPERTY_ID}`,
      dimensions: [{ name: 'eventName' }],
      metrics: [{ name: 'eventCount' }],
      dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
      dimensionFilter: {
        filter: { fieldName: 'eventName', stringFilter: { value: 'affiliate_click' } }
      }
    });
    const clicks = clickResponse.rows?.[0]?.metricValues?.[0]?.value || '0';

    // Page views + users
    const [summaryResponse] = await client.runReport({
      property: `properties/${GA4_PROPERTY_ID}`,
      metrics: [
        { name: 'screenPageViews' },
        { name: 'activeUsers' },
        { name: 'newUsers' },
        { name: 'sessions' },
      ],
      dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
    });
    const summary = summaryResponse.rows?.[0]?.metricValues || [];

    // Clean up temp key
    if (process.env.GA4_SERVICE_ACCOUNT_KEY) {
      try { fs.unlinkSync(path.join(__dirname, '..', '.ga4-tmp-key.json')); } catch (_) {}
    }

    return {
      affiliateClicks: clicks,
      pageViews: summary[0]?.value || '?',
      activeUsers: summary[1]?.value || '?',
      newUsers: summary[2]?.value || '?',
      sessions: summary[3]?.value || '?',
    };
  } catch (e) {
    console.error('GA4 API error:', e.message);
    return null;
  }
}

async function main() {
  const pages = countPages();
  const cities = countCities();
  const subsidies = countSubsidies();
  const lastModified = getLastModified();
  const affiliatePrograms = countAffiliatePrograms();
  const ga4 = await getGA4AffiliateClicks();

  const now = new Date().toISOString();
  const weekOf = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });

  // アクセスレポート（サイト統計 + GA4）
  const accessFields = [
    { name: 'HTMLページ数', value: `${pages}`, inline: true },
    { name: '対応市区町村数', value: `${cities}`, inline: true },
    { name: '補助金掲載件数', value: `${subsidies}`, inline: true },
  ];
  if (ga4) {
    accessFields.push(
      { name: 'PV (7日間)', value: ga4.pageViews, inline: true },
      { name: 'ユーザー', value: ga4.activeUsers, inline: true },
      { name: '新規ユーザー', value: ga4.newUsers, inline: true },
      { name: 'セッション', value: ga4.sessions, inline: true },
    );
  }
  accessFields.push(
    { name: 'アフィリエイト数', value: `${affiliatePrograms}`, inline: true },
    { name: '最終ビルド日', value: lastModified, inline: true },
  );
  const accessEmbed = {
    title: `週次レポート (${weekOf})`,
    color: 0x1a5c3a,
    fields: accessFields,
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

  // LINE登録ユーザー数を取得
  let lineUsers = '取得不可';
  const LINE_PUSH_URL = process.env.LINE_PUSH_URL;
  const LINE_PUSH_SECRET = process.env.LINE_PUSH_SECRET;
  if (LINE_PUSH_URL && LINE_PUSH_SECRET) {
    try {
      const usersUrl = LINE_PUSH_URL.replace('/line/push', '/line/users');
      const lineRes = await new Promise((resolve) => {
        const url = new URL(usersUrl);
        const req = https.request({
          hostname: url.hostname, path: url.pathname, method: 'GET',
          headers: { 'Authorization': `Bearer ${LINE_PUSH_SECRET}` },
        }, (res) => {
          let body = '';
          res.on('data', d => body += d);
          res.on('end', () => resolve(body));
        });
        req.on('error', () => resolve('[]'));
        req.end();
      });
      const users = JSON.parse(lineRes);
      lineUsers = `${users.length}人`;
    } catch (_) {}
  }

  // 成果報酬チャンネル
  if (WEBHOOK_CLICKS) {
    const clicksFields = [
      { name: 'アフィリエイトクリック (7日)', value: ga4 ? ga4.affiliateClicks : '取得不可', inline: true },
      { name: 'プログラム数', value: `${affiliatePrograms}`, inline: true },
      { name: 'LINE登録ユーザー', value: lineUsers, inline: true },
    ];
    const clicksEmbed = {
      title: `A8.net 週次サマリー (${weekOf})`,
      color: 0xc8a84b,
      fields: clicksFields,
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
