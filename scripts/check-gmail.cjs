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
    const fields = important.map(e => ({
      name: `${e.from}`,
      value: `**${e.subject}**\n${e.snippet}`,
    }));
    await sendDiscord([{
      title: `📧 ${important.length}件の重要メール`,
      color: 0xc8a84b,
      fields: fields.slice(0, 10),
      timestamp: new Date().toISOString(),
    }]);
    console.log('Discord notification sent');
  } else {
    console.log('No important unread emails');
  }
}

main().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
