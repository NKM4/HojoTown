const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const subsidiesDir = path.join(__dirname, '..', 'src', 'data', 'subsidies');

function checkUrl(url) {
  return new Promise((resolve) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.request(url, { method: 'HEAD', timeout: 10000 }, (res) => {
      resolve(res.statusCode);
    });
    req.on('error', () => resolve('ERROR'));
    req.on('timeout', () => { req.destroy(); resolve('TIMEOUT'); });
    req.end();
  });
}

async function main() {
  const files = fs.readdirSync(subsidiesDir).filter(f => f.endsWith('.json'));
  let total = 0;
  let broken = 0;
  let ok = 0;

  console.log(`Checking ${files.length} cities...\n`);

  for (const file of files) {
    const city = file.replace('.json', '');
    const data = JSON.parse(fs.readFileSync(path.join(subsidiesDir, file), 'utf-8'));
    const urls = new Set();

    for (const subsidy of data) {
      if (subsidy.officialUrl) urls.add(subsidy.officialUrl);
    }

    for (const url of urls) {
      total++;
      const status = await checkUrl(url);
      if (status === 200 || status === 301 || status === 302) {
        ok++;
        console.log(`OK | ${city} | ${url} | ${status}`);
      } else {
        broken++;
        console.log(`BROKEN | ${city} | ${url} | ${status}`);
      }
    }
  }

  console.log(`\n--- Summary ---`);
  console.log(`Total: ${total}, OK: ${ok}, Broken: ${broken}`);

  if (broken > 0) {
    process.exit(1);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
