/**
 * リンク切れURL修正スクリプト
 * 1. broken-urls.txt を読み込み
 * 2. 各URLのリダイレクト先を確認 or トップページにフォールバック
 * 3. subsidies JSONを更新
 *
 * Usage: node scripts/fix-broken-urls.cjs [broken-urls-file]
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const subsidiesDir = path.join(__dirname, '..', 'src', 'data', 'subsidies');
const inputFile = process.argv[2] || '/tmp/broken-urls-list.txt';

function followRedirect(url, maxRedirects = 5) {
  return new Promise((resolve) => {
    if (maxRedirects <= 0) { resolve(null); return; }
    const mod = url.startsWith('https') ? https : http;
    const req = mod.request(url, { method: 'HEAD', timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HojoTown URL Checker)' }
    }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        const newUrl = new URL(res.headers.location, url).href;
        resolve(followRedirect(newUrl, maxRedirects - 1));
      } else if (res.statusCode === 200) {
        resolve(url);
      } else {
        resolve(null);
      }
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.end();
  });
}

function getTopPage(url) {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}/`;
  } catch { return null; }
}

async function main() {
  if (!fs.existsSync(inputFile)) {
    console.error(`入力ファイルが見つかりません: ${inputFile}`);
    process.exit(1);
  }

  const lines = fs.readFileSync(inputFile, 'utf-8').split('\n').filter(l => l.includes('BROKEN'));
  console.log(`${lines.length}件のBROKEN URLを処理します\n`);

  // city -> [{old, status}] のマップ
  const fixes = {};
  let fixed = 0, fallback = 0, unchanged = 0;

  for (let i = 0; i < lines.length; i++) {
    const parts = lines[i].split('|').map(s => s.trim());
    if (parts.length < 3) continue;
    const city = parts[1];
    const oldUrl = parts[2];
    const status = parts[3];

    process.stdout.write(`[${i + 1}/${lines.length}] ${city}: ${oldUrl.substring(0, 60)}... `);

    // まずリダイレクト先を確認 (404でもサーバーがリダイレクトしてる場合がある)
    let newUrl = null;
    if (status !== 'ERROR') {
      // GETでリダイレクトを追跡
      newUrl = await followRedirect(oldUrl);
    }

    if (newUrl && newUrl !== oldUrl) {
      console.log(`→ ${newUrl.substring(0, 60)}`);
      if (!fixes[city]) fixes[city] = [];
      fixes[city].push({ old: oldUrl, new: newUrl });
      fixed++;
    } else {
      // トップページにフォールバック
      const top = getTopPage(oldUrl);
      if (top) {
        console.log(`→ トップページ: ${top}`);
        if (!fixes[city]) fixes[city] = [];
        fixes[city].push({ old: oldUrl, new: top });
        fallback++;
      } else {
        console.log('→ 修正不可');
        unchanged++;
      }
    }
  }

  // JSONファイルを更新
  console.log(`\n--- 修正適用 ---`);
  let filesUpdated = 0;
  for (const [city, cityFixes] of Object.entries(fixes)) {
    const jsonFile = path.join(subsidiesDir, `${city}.json`);
    if (!fs.existsSync(jsonFile)) {
      console.log(`SKIP: ${city}.json が見つかりません`);
      continue;
    }
    const data = JSON.parse(fs.readFileSync(jsonFile, 'utf-8'));
    let changed = false;
    for (const fix of cityFixes) {
      for (const subsidy of data) {
        if (subsidy.officialUrl === fix.old) {
          subsidy.officialUrl = fix.new;
          changed = true;
        }
      }
    }
    if (changed) {
      fs.writeFileSync(jsonFile, JSON.stringify(data, null, 2) + '\n', 'utf-8');
      filesUpdated++;
      console.log(`UPDATED: ${city}.json (${cityFixes.length}件)`);
    }
  }

  console.log(`\n--- Summary ---`);
  console.log(`リダイレクト先で修正: ${fixed}件`);
  console.log(`トップページにフォールバック: ${fallback}件`);
  console.log(`修正不可: ${unchanged}件`);
  console.log(`更新ファイル数: ${filesUpdated}`);
}

main().catch(e => { console.error(e); process.exit(1); });
