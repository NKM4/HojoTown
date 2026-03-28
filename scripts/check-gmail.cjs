/**
 * Gmail定期チェック: A8/AdSense/タウンライフのメールを確認してDiscordに通知
 * Chrome CDP (port 9223) 経由でGmailにログイン→受信トレイ確認
 */
const { chromium } = require('C:/Users/NKM/AppData/Roaming/npm/node_modules/@playwright/test/node_modules/playwright');
const https = require('https');

const GMAIL_EMAIL = 'hojotown2026@gmail.com';
const GMAIL_PASSWORD = 'REDACTED_PASSWORD';
const DISCORD_WEBHOOK = 'REDACTED_DISCORD_WEBHOOK';

function sendDiscord(embeds) {
  return new Promise((resolve, reject) => {
    const url = new URL(DISCORD_WEBHOOK);
    const data = JSON.stringify({ embeds });
    const req = https.request({
      hostname: url.hostname, path: url.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, res => { let b = ''; res.on('data', d => b += d); res.on('end', () => resolve(b)); });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9223');
  const context = browser.contexts()[0];
  let page = context.pages().find(p => p.url().includes('mail.google'));

  // Gmailが開いてなければ新しいタブで開く
  if (!page) {
    page = await context.newPage();
    await page.goto('https://mail.google.com');
    await page.waitForTimeout(5000);
  }

  // ログインが必要な場合
  if (page.url().includes('accounts.google.com')) {
    console.log('Logging in to Gmail...');
    const emailInput = page.locator('input[type=email]');
    if (await emailInput.isVisible().catch(() => false)) {
      await emailInput.fill(GMAIL_EMAIL);
      await page.locator('#identifierNext, button:has-text("次へ")').click();
      await page.waitForTimeout(3000);
    }
    const pwInput = page.locator('input[type=password]');
    if (await pwInput.isVisible().catch(() => false)) {
      await pwInput.fill(GMAIL_PASSWORD);
      await page.locator('#passwordNext, button:has-text("次へ")').click();
      await page.waitForTimeout(5000);
    }
    console.log('Login URL:', page.url());
  }

  if (!page.url().includes('mail.google.com/mail')) {
    console.log('Gmail login failed:', page.url());
    return;
  }

  // 受信トレイからメールを取得
  await page.waitForTimeout(3000);
  const emails = await page.evaluate(() => {
    const rows = document.querySelectorAll('tr.zA');
    return Array.from(rows).slice(0, 20).map(row => {
      const from = row.querySelector('.yW span')?.textContent?.trim() || '';
      const subject = row.querySelector('.bog span')?.textContent?.trim() || '';
      const snippet = row.querySelector('.y2')?.textContent?.trim() || '';
      const unread = row.classList.contains('zE');
      return { from, subject, snippet: snippet.substring(0, 100), unread };
    });
  });

  console.log(`Found ${emails.length} emails, ${emails.filter(e => e.unread).length} unread`);

  // 重要なメールをフィルタ
  const keywords = ['A8.net', 'AdSense', 'adsense', 'タウンライフ', 'townlife', '承認', '審査', '成果'];
  const important = emails.filter(e =>
    e.unread && keywords.some(k => e.from.includes(k) || e.subject.includes(k))
  );

  if (important.length > 0) {
    console.log(`Important emails: ${important.length}`);

    // カテゴリ別に分類してサマリー作成
    const a8 = important.filter(e => e.from.includes('A8') || e.from.includes('ec-mail') || e.subject.includes('A8'));
    const adsense = important.filter(e => e.from.includes('AdSense') || e.from.includes('adsense') || e.subject.includes('AdSense'));
    const townlife = important.filter(e => e.from.includes('タウンライフ') || e.from.includes('townlife'));
    const other = important.filter(e => !a8.includes(e) && !adsense.includes(e) && !townlife.includes(e));

    const embeds = [];

    if (a8.length > 0) {
      const承認 = a8.filter(e => e.subject.includes('承認'));
      const成果 = a8.filter(e => e.subject.includes('成果') || e.subject.includes('報酬'));
      let desc = '';
      if (承認.length > 0) desc += `✅ ${承認.length}件の提携承認\n`;
      if (成果.length > 0) desc += `💰 ${成果.length}件の成果通知\n`;
      if (desc === '') desc = `${a8.length}件のA8.net通知`;
      embeds.push({
        title: `A8.net: ${a8.length}件`,
        description: desc,
        color: 0x00a0e9,
        fields: a8.slice(0, 5).map(e => ({ name: e.subject.substring(0, 50), value: e.snippet || '—' })),
      });
    }

    if (adsense.length > 0) {
      embeds.push({
        title: `🔔 AdSense: ${adsense.length}件`,
        description: adsense.map(e => `**${e.subject}**`).join('\n'),
        color: 0x4285f4,
      });
    }

    if (townlife.length > 0) {
      embeds.push({
        title: `🔔 タウンライフ: ${townlife.length}件`,
        description: townlife.map(e => `**${e.subject}**`).join('\n'),
        color: 0xff6600,
      });
    }

    if (other.length > 0) {
      embeds.push({
        title: `📧 その他: ${other.length}件`,
        fields: other.slice(0, 5).map(e => ({ name: `${e.from}: ${e.subject.substring(0, 40)}`, value: e.snippet || '—' })),
        color: 0x999999,
      });
    }

    // タイムスタンプ追加
    embeds.forEach(e => e.timestamp = new Date().toISOString());

    await sendDiscord(embeds);
    console.log('Discord notification sent');
  } else {
    console.log('No important unread emails');
  }
}

main().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
