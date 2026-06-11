const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const crypto = require('crypto');

const subsidiesDir = path.join(__dirname, '..', 'src', 'data', 'subsidies');
const hashFile = process.env.CONTENT_HASH_FILE || path.join(__dirname, '..', 'content-hashes.json');
const changesFile = process.env.CONTENT_CHANGES_FILE || path.join(__dirname, '..', 'content-changes.json');
const changedPagesFile = process.env.CONTENT_CHANGED_PAGES_FILE || path.join(__dirname, '..', 'changed-pages.txt');
const NORMALIZER_VERSION = 2;

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const CHECK_CONCURRENCY = parsePositiveInt(process.env.CONTENT_CHECK_CONCURRENCY, 8);

async function mapLimit(items, limit, worker) {
  const results = [];
  let index = 0;
  const workers = Array.from({ length: Math.max(1, limit) }, async () => {
    while (index < items.length) {
      const currentIndex = index++;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  });
  await Promise.all(workers);
  return results;
}

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
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => resolve(decodeResponse(Buffer.concat(chunks), res.headers['content-type'] || '')));
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

function decodeResponse(buffer, contentType) {
  const utf8 = buffer.toString('utf8');
  const charset = (contentType.match(/charset=([^;\s]+)/i)?.[1] || utf8.match(/<meta[^>]+charset=["']?([^"'>\s]+)/i)?.[1] || '').toLowerCase();
  if (/shift[_-]?jis|windows-31j|cp932/.test(charset)) {
    try {
      return new TextDecoder('shift_jis').decode(buffer);
    } catch {
      return utf8;
    }
  }
  if (/euc-?jp/.test(charset)) {
    try {
      return new TextDecoder('euc-jp').decode(buffer);
    } catch {
      return utf8;
    }
  }
  return utf8;
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
    .replace(/\uFFFD/g, '')
    .replace(/\b\d{4}[-/.年]\d{1,2}[-/.月]\d{1,2}日?\b/g, 'DATE')
    .replace(/令和\d{1,2}年\d{1,2}月\d{1,2}日/g, 'DATE')
    .replace(/平成\d{1,2}年\d{1,2}月\d{1,2}日/g, 'DATE')
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
  return text.slice(0, 1200);
}

function comparableSample(text) {
  return (text || '')
    .replace(/\uFFFD/g, '')
    .replace(/\b\d{4}[-/.年]\d{1,2}[-/.月]\d{1,2}日?\b/g, 'DATE')
    .replace(/令和\d{1,2}年\d{1,2}月\d{1,2}日/g, 'DATE')
    .replace(/平成\d{1,2}年\d{1,2}月\d{1,2}日/g, 'DATE')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 320);
}

function contentSignature(text) {
  if (!text) return null;
  if (text.length <= 2400) return hashContent(text);
  const chunks = [
    text.slice(0, 800),
    text.slice(Math.max(0, Math.floor(text.length / 2) - 400), Math.floor(text.length / 2) + 400),
    text.slice(-800),
  ];
  return hashContent(chunks.join('\n---chunk---\n'));
}

function hasMeaningfulChange(previous, current) {
  if (!previous?.hash || !current.hash) return false;
  if (previous.normalizerVersion !== NORMALIZER_VERSION) return false;
  if (comparableSample(previous.sample) === comparableSample(current.sample)) {
    return false;
  }
  if (previous.signature && current.signature) {
    return previous.signature !== current.signature;
  }
  return previous.hash !== current.hash;
}

function isErrorPage(title, text) {
  const probe = `${title || ''} ${text || ''}`.slice(0, 2000);
  return /お探しのページ|ページが見つかりません|見つかりませんでした|表示できません|not found|404|403 forbidden/i.test(probe);
}

function readPreviousState() {
  if (!fs.existsSync(hashFile)) return {};
  const raw = JSON.parse(fs.readFileSync(hashFile, 'utf8'));
  const state = {};
  for (const [key, value] of Object.entries(raw)) {
    state[key] = typeof value === 'string'
      ? { hash: value, signature: '', title: '', sample: '', checkedAt: '' }
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
  const targets = [];

  console.log(`Checking content changes for ${files.length} cities...\n`);

  for (const file of files) {
    const city = file.replace('.json', '');
    const data = JSON.parse(fs.readFileSync(path.join(subsidiesDir, file), 'utf8'));
    const urls = new Set();
    for (const s of data) {
      if (s.officialUrl) urls.add(s.officialUrl);
    }

    for (const url of urls) {
      targets.push({ city, url });
    }
  }

  console.log(`Checking ${targets.length} URLs with concurrency ${CHECK_CONCURRENCY}...\n`);

  let checked = 0;
  const results = await mapLimit(targets, CHECK_CONCURRENCY, async ({ city, url }) => {
    const html = await fetchPage(url);
    const normalized = normalizeContent(html);
    const title = extractTitle(html, city);
    const errorPage = isErrorPage(title, normalized);
    const hash = errorPage ? null : hashContent(normalized);
    const key = `${city}|${url}`;
    const current = {
      city,
      url,
      title,
      hash,
      signature: contentSignature(normalized),
      sample: sampleText(normalized),
      errorPage,
      normalizerVersion: NORMALIZER_VERSION,
      checkedAt: new Date().toISOString(),
    };
    checked++;
    if (checked % 100 === 0) console.log(`[${checked}/${targets.length} URLs checked]`);
    return { key, current, previous: prevState[key] };
  });

  for (const { key, current, previous } of results) {
    newState[key] = current;

    if (!current.hash) {
      unavailable.push({ city: current.city, url: current.url });
      continue;
    }

    if (hasMeaningfulChange(previous, current)) {
      const item = {
        city: current.city,
        url: current.url,
        title: current.title,
        previousTitle: previous.title || '',
        previousSample: previous.sample || '',
        currentSample: current.sample,
      };
      changed.push(item);
      console.log(`CHANGED | ${current.city} | ${current.url}`);
    }
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
