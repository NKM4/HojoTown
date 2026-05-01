/**
 * Gmail → Discord #メール 転送スクリプト
 * Gmail API (OAuth2) でtaitatu4alexandrosのメールを安全にチェック
 *
 * 初回セットアップ:
 *   1. GCP Console → APIs → Gmail API有効化
 *   2. OAuth同意画面 → テストユーザーにtaitatu4alexandros追加
 *   3. 認証情報 → OAuth 2.0クライアントID (Desktop App) 作成 → JSONダウンロード
 *   4. bot/gmail-credentials.json に保存
 *   5. node scripts/gmail-notify.cjs --auth  (ブラウザが開くので認証)
 *   6. bot/gmail-token.json が生成される
 *
 * 定期実行: node scripts/gmail-notify.cjs
 *
 * 環境変数 (bot/.env):
 *   DISCORD_MAIL_WEBHOOK - #メール チャンネルのWebhook URL
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const { google } = require('googleapis');

// パス設定
const BOT_DIR = path.join(__dirname, '..', 'bot');
const CREDENTIALS_PATH = path.join(BOT_DIR, 'gmail-credentials.json');
const TOKEN_PATH = path.join(BOT_DIR, 'gmail-token.json');
const LAST_CHECK_PATH = path.join(BOT_DIR, 'gmail-last-check.json');
const ENV_PATH = path.join(BOT_DIR, '.env');

// .env読み込み
function loadEnv() {
  if (fs.existsSync(ENV_PATH)) {
    const lines = fs.readFileSync(ENV_PATH, 'utf-8').split('\n');
    for (const line of lines) {
      if (line && !line.startsWith('#')) {
        const [key, ...vals] = line.split('=');
        if (key && vals.length) process.env[key.trim()] = vals.join('=').trim();
      }
    }
  }
}
loadEnv();

const DISCORD_WEBHOOK = process.env.DISCORD_MAIL_WEBHOOK;
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

// ホジョタウン関連メールのフィルタ
const SEARCH_QUERY = '(from:a8.net OR from:google.com OR from:adsense OR from:noreply@github.com OR subject:hojotown OR subject:ホジョタウン) newer_than:1d is:unread';

// カテゴリ分類
function categorizeEmail(from, subject) {
  const f = (from || '').toLowerCase();
  const s = (subject || '').toLowerCase();

  if (f.includes('a8.net') || f.includes('a8')) {
    if (s.includes('承認') || s.includes('提携')) return { category: 'A8.net 提携', color: 0xc8a84b, icon: '🤝' };
    return { category: 'A8.net', color: 0xf5a623, icon: '📊' };
  }
  if (f.includes('adsense') || s.includes('adsense')) {
    return { category: 'AdSense', color: 0x4285f4, icon: '💰' };
  }
  if (f.includes('search-console') || f.includes('sc-noreply') || s.includes('search console')) {
    return { category: 'Search Console', color: 0x34a853, icon: '📈' };
  }
  if (f.includes('github') || f.includes('noreply@github.com')) {
    if (s.includes('hojotown')) return { category: 'GitHub (HojoTown)', color: 0x24292e, icon: '🔔' };
    return null; // HojoTown以外のGitHub通知は無視
  }
  if (s.includes('hojotown') || s.includes('ホジョタウン')) {
    return { category: 'ホジョタウン', color: 0x1a5c3a, icon: '🏠' };
  }
  return { category: 'その他', color: 0x999999, icon: '📧' };
}

// Discord送信
function sendDiscord(embeds) {
  if (!DISCORD_WEBHOOK) {
    console.log('DISCORD_MAIL_WEBHOOK未設定、スキップ');
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const url = new URL(DISCORD_WEBHOOK);
    const data = JSON.stringify({ embeds: embeds.slice(0, 10) }); // Discord上限10 embeds
    const req = https.request({
      hostname: url.hostname, path: url.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, res => { let b = ''; res.on('data', d => b += d); res.on('end', () => resolve(b)); });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// OAuth2クライアント作成
function getAuthClient() {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    console.error(`❌ ${CREDENTIALS_PATH} が見つかりません`);
    console.error('GCP Console → 認証情報 → OAuth 2.0クライアントID (Desktop App) → JSONダウンロード');
    process.exit(1);
  }
  const creds = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));
  const { client_id, client_secret, redirect_uris } = creds.installed || creds.web || {};
  const oauth2 = new google.auth.OAuth2(client_id, client_secret, redirect_uris?.[0] || 'http://localhost');

  if (fs.existsSync(TOKEN_PATH)) {
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
    oauth2.setCredentials(token);
    // トークン更新時に自動保存
    oauth2.on('tokens', (tokens) => {
      const current = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
      const updated = { ...current, ...tokens };
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(updated, null, 2));
      console.log('トークン自動更新完了');
    });
  }
  return oauth2;
}

// 初回認証フロー
async function authorize() {
  const oauth2 = getAuthClient();
  const authUrl = oauth2.generateAuthUrl({ access_type: 'offline', scope: SCOPES, prompt: 'consent' });

  console.log('ブラウザで以下のURLを開いて認証してください:');
  console.log(authUrl);
  console.log('');

  // 簡易HTTPサーバーでコールバック受信
  const http = require('http');
  const { URL } = require('url');

  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        const reqUrl = new URL(req.url, 'http://localhost');
        const code = reqUrl.searchParams.get('code');
        if (!code) { res.end('No code received'); return; }

        const { tokens } = await oauth2.getToken(code);
        oauth2.setCredentials(tokens);
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));

        res.end('認証成功！このタブは閉じてOKです。');
        console.log('✅ トークン保存完了: ' + TOKEN_PATH);
        server.close();
        resolve();
      } catch (err) {
        res.end('エラー: ' + err.message);
        reject(err);
      }
    });

    // redirect_uriからポート取得、なければ3000
    const creds = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));
    const redirectUri = (creds.installed || creds.web || {}).redirect_uris?.[0] || 'http://localhost:3000';
    const port = new URL(redirectUri).port || 3000;

    server.listen(port, () => {
      console.log(`コールバック待機中 (port ${port})...`);
      // ブラウザを開く
      const { exec } = require('child_process');
      exec(`start "" "${authUrl}"`);
    });
  });
}

// メールチェック＆通知
async function checkAndNotify() {
  const oauth2 = getAuthClient();

  if (!oauth2.credentials || !oauth2.credentials.access_token) {
    console.error('❌ トークンがありません。先に --auth で認証してください');
    process.exit(1);
  }

  const gmail = google.gmail({ version: 'v1', auth: oauth2 });

  // 受信アカウントを取得（通知に表示するため）
  let recipientEmail = 'unknown';
  try {
    const profile = await gmail.users.getProfile({ userId: 'me' });
    recipientEmail = profile.data.emailAddress || 'unknown';
  } catch (e) {}

  // 最後のチェック時刻を読み込み
  let lastCheckTime = null;
  if (fs.existsSync(LAST_CHECK_PATH)) {
    const data = JSON.parse(fs.readFileSync(LAST_CHECK_PATH, 'utf-8'));
    lastCheckTime = data.lastCheck;
  }

  console.log(`最終チェック: ${lastCheckTime || '初回'}`);
  console.log(`検索: ${SEARCH_QUERY}`);

  // メール検索
  const res = await gmail.users.messages.list({
    userId: 'me',
    q: SEARCH_QUERY,
    maxResults: 20,
  });

  const messages = res.data.messages || [];
  console.log(`${messages.length}件の未読メール検出`);

  if (messages.length === 0) {
    // チェック時刻更新
    fs.writeFileSync(LAST_CHECK_PATH, JSON.stringify({ lastCheck: new Date().toISOString() }, null, 2));
    return;
  }

  const embeds = [];
  const lastCheckMs = lastCheckTime ? Date.parse(lastCheckTime) : 0;

  for (const msg of messages) {
    const detail = await gmail.users.messages.get({
      userId: 'me',
      id: msg.id,
      format: 'metadata',
      metadataHeaders: ['From', 'Subject', 'Date'],
    });

    const internalDateMs = Number(detail.data.internalDate || 0);
    if (lastCheckMs && internalDateMs && internalDateMs <= lastCheckMs) {
      console.log(`  skip: 前回チェック済み ${msg.id}`);
      continue;
    }

    const headers = detail.data.payload.headers;
    const from = headers.find(h => h.name === 'From')?.value || '';
    const subject = headers.find(h => h.name === 'Subject')?.value || '(件名なし)';
    const date = headers.find(h => h.name === 'Date')?.value || '';

    const cat = categorizeEmail(from, subject);
    if (!cat) continue; // フィルタで除外

    embeds.push({
      title: `${cat.icon} ${cat.category}`,
      description: `**${subject}**\n\n差出人: ${from}\n日時: ${date}`,
      color: cat.color,
      footer: { text: `📬 ${recipientEmail}` },
    });

    console.log(`  ${cat.icon} [${cat.category}] ${subject}`);
  }

  // Discord送信（10件ずつ分割）
  if (embeds.length > 0) {
    for (let i = 0; i < embeds.length; i += 10) {
      await sendDiscord(embeds.slice(i, i + 10));
    }
    console.log(`Discord送信完了: ${embeds.length}件`);
  }

  // チェック時刻更新
  fs.writeFileSync(LAST_CHECK_PATH, JSON.stringify({ lastCheck: new Date().toISOString() }, null, 2));
  console.log('✅ チェック完了');
}

// メイン
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--auth')) {
    await authorize();
  } else {
    await checkAndNotify();
  }
}

main().catch(e => {
  console.error('❌ エラー:', e.message);
  process.exit(1);
});
