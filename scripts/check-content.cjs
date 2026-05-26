const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const crypto = require('crypto');

const subsidiesDir = path.join(__dirname, '..', 'src', 'data', 'subsidies');
const hashFile = path.join(__dirname, '..', 'content-hashes.json');
const changesFile = path.join(__dirname, '..', 'content-changes.json');
const changedPagesFile = path.join(__dirname, '..', 'changed-pages.txt');

function fetchPage(url, maxRedirects = 5) {
  return new Promise((resolve) => {
    if (maxRedirects <= 0) return resolve(null);
    let currentUrl;
    try {
      currentUrl = new URL(url);
    } catch {
      return resolve(null);
    }
    const mod = currentUrl.protocol === 'https:' ? https : http;
    const req = mod.get(currentUrl, {
      timeout: 15000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HojoTown Content Monitor)' }
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const nextUrl = new URL(res.headers.location, currentUrl).toString();
        return resolve(fetchPage(nextUrl, maxRedirects - 1));
      }
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve(body));
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

function decodeEntities(text) {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function normalizeContent(html) {
  if (!html) return '';
  return decodeEntities(html)
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<(header|footer|nav|aside|svg|canvas|form|iframe)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\b\d{4}[-/.年]\d{1,2}[-/.月]\d{1,2}日?\b/g, 'DATE')
    .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, 'TIME')
    .replace(/\s+/g, ' ')
    .trim();
}

function hashContent(text) {
  if (!text) return null;
  return crypto.createHash('sha256').update(text).digest('hex');
}

function extractTitle(html, fallback) {
  if (!html) return fallback;
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const title = h1 || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!title) return fallback;
  return normalizeContent(title[1]).slice(0, 120) || fallback;
}

function sampleText(text) {
  return text.slice(0, 320);
}

function readPreviousState() {
  if (!fs.existsSync(hashFile)) return {};
  const raw = JSON.parse(fs.readFileSync(hashFile, 'utf8'));
  const state = {};
  for (const [key, value] of Object.entries(raw)) {
    state[key] = typeof value === 'string'
      ? { hash: value, title: '', sample: '', checkedAt: '' }
      : value;
  }
  return state;
}

async function main() {
  const prevState = readPreviousState();
  const newState = {};
  const changed = [];
  const unavailable = [];
  const files = fs.readdirSync(subsidiesDir).filter(f => f.endsWith('.json'));

  console.log(`Checking content changes for ${files.length} cities...\n`);

  let checked = 0;
  for (const file of files) {
    const city = file.replace('.json', '');
    const data = JSON.parse(fs.readFileSync(path.join(subsidiesDir, file), 'utf8'));
    const urls = new Set();
    for (const s of data) {
      if (s.officialUrl) urls.add(s.officialUrl);
    }

    for (const url of urls) {
      checked++;
      const html = await fetchPage(url);
      const normalized = normalizeContent(html);
      const hash = hashContent(normalized);
      const key = `${city}|${url}`;
      const title = extractTitle(html, city);
      const current = {
        city,
        url,
        title,
        hash,
        sample: sampleText(normalized),
        checkedAt: new Date().toISOString(),
      };
      newState[key] = current;

      if (!hash) {
        unavailable.push({ city, url });
        continue;
      }

      const previous = prevState[key];
      if (previous?.hash && previous.hash !== hash) {
        const item = {
          city,
          url,
          title,
          previousTitle: previous.title || '',
          previousSample: previous.sample || '',
          currentSample: current.sample,
        };
        changed.push(item);
        console.log(`CHANGED | ${city} | ${url}`);
      }
    }

    if (checked % 50 === 0) console.log(`[${checked} URLs checked]`);
  }

  fs.writeFileSync(hashFile, JSON.stringify(newState, null, 2));
  fs.writeFileSync(changesFile, JSON.stringify({
    checkedAt: new Date().toISOString(),
    totalUrls: checked,
    changedCount: changed.length,
    unavailableCount: unavailable.length,
    changed,
    unavailable,
  }, null, 2));
  fs.writeFileSync(changedPagesFile, changed.map(c => [
    `city: ${c.city}`,
    `title: ${c.title}`,
    `url: ${c.url}`,
    `old: ${c.previousSample}`,
    `new: ${c.currentSample}`,
    '',
  ].join('\n')).join('\n'));

  console.log(`\n--- Summary ---`);
  console.log(`Total URLs: ${checked}`);
  console.log(`Changed: ${changed.length}`);
  console.log(`Unavailable: ${unavailable.length}`);
  console.log(`Hash file: ${hashFile}`);
  console.log(`Changes file: ${changesFile}`);

  if (changed.length > 0) {
    console.log('\nChanged pages:');
    for (const c of changed) console.log(`  ${c.city}: ${c.title} - ${c.url}`);
  }

  if (unavailable.length > 0) {
    console.log('\nUnavailable pages:');
    for (const c of unavailable) console.log(`  ${c.city}: ${c.url}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
