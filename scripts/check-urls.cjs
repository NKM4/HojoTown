const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const subsidiesDir = path.join(__dirname, '..', 'src', 'data', 'subsidies');

function isOkStatus(status) {
  return typeof status === 'number' && status >= 200 && status < 400;
}

function isKnownBotBlock(url, status) {
  if (status !== 403) return false;
  try {
    const { hostname } = new URL(url);
    // Mitaka City pages are reachable by normal browsers/search crawlers, but GitHub runners
    // can receive WAF 403 responses. Treat this host as a soft pass to avoid false alerts.
    return hostname === 'www.city.mitaka.lg.jp';
  } catch {
    return false;
  }
}

function requestStatus(url, method = 'HEAD', maxRedirects = 5) {
  return new Promise((resolve) => {
    if (maxRedirects < 0) return resolve('TOO_MANY_REDIRECTS');
    const mod = url.startsWith('https') ? https : http;
    const opts = {
      method,
      timeout: 20000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HojoTown URL Checker)' }
    };
    const req = mod.request(url, opts, (res) => {
      res.resume();
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const nextUrl = new URL(res.headers.location, url).toString();
        resolve(requestStatus(nextUrl, method, maxRedirects - 1));
      } else {
        resolve(res.statusCode);
      }
    });
    req.on('error', () => resolve('ERROR'));
    req.on('timeout', () => { req.destroy(); resolve('TIMEOUT'); });
    req.end();
  });
}

async function checkUrl(url) {
  const headStatus = await requestStatus(url, 'HEAD');
  if (isOkStatus(headStatus)) return headStatus;
  if (isKnownBotBlock(url, headStatus)) return headStatus;

  // Some municipal sites block, throttle, or delay HEAD. Verify with GET before marking broken.
  if ([403, 405, 501, 'ERROR', 'TIMEOUT'].includes(headStatus)) {
    const getStatus = await requestStatus(url, 'GET');
    if (isOkStatus(getStatus)) return getStatus;
    if (isKnownBotBlock(url, getStatus)) return getStatus;

    // One extra retry reduces false positives from slow municipal servers.
    if (['ERROR', 'TIMEOUT', 502, 503].includes(getStatus)) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const retryStatus = await requestStatus(url, 'GET');
      if (isKnownBotBlock(url, retryStatus)) return retryStatus;
      return retryStatus;
    }
    return getStatus;
  }

  return headStatus;
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
      if (isOkStatus(status)) {
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
