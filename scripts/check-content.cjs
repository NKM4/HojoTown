const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const crypto = require('crypto');

const subsidiesDir = path.join(__dirname, '..', 'src', 'data', 'subsidies');
const hashFile = path.join(__dirname, '..', 'content-hashes.json');

function fetchPage(url) {
  return new Promise((resolve) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, {
      timeout: 15000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HojoTown Content Monitor)' }
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchPage(res.headers.location));
      }
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve(body));
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

function hashContent(html) {
  if (!html) return null;
  // HTMLタグを除去してテキスト部分だけハッシュ（レイアウト変更を無視するため）
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return crypto.createHash('md5').update(text).digest('hex');
}

async function main() {
  const prevHashes = fs.existsSync(hashFile) ? JSON.parse(fs.readFileSync(hashFile, 'utf8')) : {};
  const newHashes = {};
  const changed = [];
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
      const hash = hashContent(html);
      const key = `${city}|${url}`;
      newHashes[key] = hash;

      if (prevHashes[key] && hash && prevHashes[key] !== hash) {
        changed.push({ city, url });
        console.log(`CHANGED | ${city} | ${url}`);
      }
    }

    if (checked % 50 === 0) console.log(`[${checked} URLs checked]`);
  }

  // ハッシュを保存
  fs.writeFileSync(hashFile, JSON.stringify(newHashes, null, 2));

  console.log(`\n--- Summary ---`);
  console.log(`Total URLs: ${checked}`);
  console.log(`Changed: ${changed.length}`);
  console.log(`Hash file: ${hashFile}`);

  if (changed.length > 0) {
    console.log('\nChanged pages:');
    for (const c of changed) console.log(`  ${c.city}: ${c.url}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
