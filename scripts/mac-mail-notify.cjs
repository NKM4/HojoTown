/** Forward relevant mail from the Mac mini Mail inbox to Discord #メール. */
const fs = require('fs');
const path = require('path');
const https = require('https');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const statePath = path.join(root, 'bot', 'mac-mail-notify-state.json');
const envPath = path.join(root, 'bot', '.env');
const host = 'miwaakihiro@192.168.1.43';
const account = 'taitatu4alexandros@gmail.com';

const appleScript = fs.readFileSync(path.join(__dirname, 'mac-mail-rows.applescript'), 'utf8');

function parseRows(raw) {
  if (!raw.trim()) return [];
  return raw.trimEnd().split('\x1e').map(line => {
    const [id, from, subject, date, read] = line.split('\x1f');
    if (!id || read === undefined) throw new Error('Mac Mail response malformed');
    return {id, from, subject, date, read: read === 'true'};
  });
}

function loadWebhook() {
  const line = fs.readFileSync(envPath, 'utf8').split(/\r?\n/).find(x => x.startsWith('DISCORD_MAIL_WEBHOOK='));
  if (!line) throw new Error('DISCORD_MAIL_WEBHOOK missing');
  return line.slice('DISCORD_MAIL_WEBHOOK='.length).trim();
}

function category(mail) {
  const from = mail.from.toLowerCase();
  const subject = mail.subject.toLowerCase();
  if (from.includes('a8.net')) return 'A8.net';
  if (from.includes('adsense') || subject.includes('adsense')) return 'AdSense';
  if (from.includes('search-console') || from.includes('sc-noreply') || subject.includes('search console')) return 'Search Console';
  if (from.includes('github')) return subject.includes('hojotown') ? 'GitHub (HojoTown)' : null;
  if (subject.includes('hojotown') || subject.includes('ホジョタウン')) return 'ホジョタウン';
  return null;
}

function send(webhook, mail, label) {
  return new Promise((resolve, reject) => {
    const url = new URL(webhook);
    const data = JSON.stringify({allowed_mentions: {parse: []}, embeds: [{
      title: `📧 ${label}`,
      description: `**${mail.subject || '(件名なし)'}**\n\n差出人: ${mail.from}\n日時: ${mail.date}`.slice(0, 4000),
      color: 0x1a5c3a,
      footer: {text: `📬 ${account}`},
    }]});
    const req = https.request(url, {method: 'POST', headers: {'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data)}}, res => {
      res.resume();
      res.on('end', () => res.statusCode >= 200 && res.statusCode < 300 ? resolve() : reject(new Error(`Discord webhook HTTP ${res.statusCode}`)));
    });
    req.on('error', reject);
    req.end(data);
  });
}

async function main() {
  const result = spawnSync('ssh', ['-T', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', host, 'osascript', '-'], {
    input: appleScript, encoding: 'utf8', timeout: 90000, maxBuffer: 1024 * 1024,
  });
  if (result.error || result.status !== 0) throw new Error(`Mac Mail read failed: ${result.error?.message || result.stderr?.trim() || result.status}`);
  const rows = parseRows(result.stdout);
  const state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, 'utf8')) : {seen: []};
  const seen = new Set(state.seen || []);
  const pending = rows.filter(mail => !mail.read && !seen.has(mail.id)).map(mail => ({mail, label: category(mail)})).filter(x => x.label);
  const webhook = loadWebhook();
  for (const {mail, label} of pending.reverse()) {
    await send(webhook, mail, label);
    seen.add(mail.id);
    fs.writeFileSync(statePath, JSON.stringify({seen: [...seen].slice(-500), lastCheck: new Date().toISOString()}, null, 2));
  }
  if (!pending.length) fs.writeFileSync(statePath, JSON.stringify({seen: [...seen].slice(-500), lastCheck: new Date().toISOString()}, null, 2));
  console.log(`Mac Mail checked: ${rows.length} recent, ${pending.length} notified`);
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
