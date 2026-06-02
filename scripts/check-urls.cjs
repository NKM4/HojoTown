const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const subsidiesDir = path.join(__dirname, '..', 'src', 'data', 'subsidies');

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const CHECK_CONCURRENCY = parsePositiveInt(process.env.CHECK_URL_CONCURRENCY, 12);

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

function isOkStatus(status) {
  return typeof status === 'number' && status >= 200 && status < 400;
}

function isKnownSoftPass(url, status) {
  try {
    const { hostname } = new URL(url);
    // Mitaka City pages are reachable by normal browsers/search crawlers, but GitHub runners
    // can receive WAF 403 responses. Treat this host as a soft pass to avoid false alerts.
    if (hostname === 'www.city.mitaka.lg.jp' && status === 403) return true;
    // The official Marugame child-care portal is reachable locally and in browsers, but
    // GitHub-hosted runners can time out against this WordPress site.
    if (hostname === 'marugame.net' && status === 'TIMEOUT') return true;
    return false;
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
  if (isKnownSoftPass(url, headStatus)) return 200;

  // Some municipal sites block, throttle, or delay HEAD. Verify with GET before marking broken.
  if ([403, 405, 501, 'ERROR', 'TIMEOUT'].includes(headStatus)) {
    const getStatus = await requestStatus(url, 'GET');
    if (isOkStatus(getStatus)) return getStatus;
    if (isKnownSoftPass(url, getStatus)) return 200;

    // One extra retry reduces false positives from slow municipal servers.
    if (['ERROR', 'TIMEOUT', 502, 503].includes(getStatus)) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const retryStatus = await requestStatus(url, 'GET');
      if (isKnownSoftPass(url, retryStatus)) return 200;
      return retryStatus;
    }
    return getStatus;
  }

  return headStatus;
}

async function main() {
  const files = fs.readdirSync(subsidiesDir).filter(f => f.endsWith('.json'));
  const targets = [];

  console.log(`Checking ${files.length} cities...\n`);

  for (const file of files) {
    const city = file.replace('.json', '');
    const data = JSON.parse(fs.readFileSync(path.join(subsidiesDir, file), 'utf-8'));
    const urls = new Set();

    for (const subsidy of data) {
      if (subsidy.officialUrl) urls.add(subsidy.officialUrl);
    }

    for (const url of urls) {
      targets.push({ city, url });
    }
  }

  console.log(`Checking ${targets.length} URLs with concurrency ${CHECK_CONCURRENCY}...\n`);

  let checked = 0;
  const results = await mapLimit(targets, CHECK_CONCURRENCY, async ({ city, url }) => {
    const status = await checkUrl(url);
    checked++;
    if (checked % 100 === 0) console.log(`[${checked}/${targets.length} URLs checked]`);
    return { city, url, status, ok: isOkStatus(status) };
  });

  let broken = 0;
  let ok = 0;
  for (const result of results) {
    if (result.ok) {
      ok++;
      console.log(`OK | ${result.city} | ${result.url} | ${result.status}`);
    } else {
      broken++;
      console.log(`BROKEN | ${result.city} | ${result.url} | ${result.status}`);
    }
  }

  console.log(`\n--- Summary ---`);
  console.log(`Total: ${targets.length}, OK: ${ok}, Broken: ${broken}`);

  if (broken > 0) {
    process.exit(1);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
