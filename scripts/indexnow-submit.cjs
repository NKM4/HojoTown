#!/usr/bin/env node
/**
 * IndexNow submit - デプロイ後に主要ページをBing/Yandex等に通知
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const HOST = 'hojotown.jp';
const KEY = 'hojotown2026indexnow';
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;

// 主要ページ + 全市ページを送信
const urls = [
  `https://${HOST}/`,
  `https://${HOST}/shindan/`,
  `https://${HOST}/compare/`,
  `https://${HOST}/about/`,
  `https://${HOST}/life/`,
];

// ライフイベントページ
const lifeEvents = ['reform', 'housing', 'baby', 'moving', 'energy', 'retirement', 'marriage', 'career', 'funeral'];
for (const e of lifeEvents) urls.push(`https://${HOST}/life/${e}/`);

// 全市ページ
const citiesJson = path.resolve(__dirname, '../src/data/cities.json');
const cities = JSON.parse(fs.readFileSync(citiesJson, 'utf-8'));
for (const c of cities) {
  urls.push(`https://${HOST}/${c.prefectureSlug}/${c.slug}/`);
}

console.log(`IndexNow: ${urls.length}ページを送信`);

// IndexNow APIはバッチで最大10,000 URL
const batchSize = 500;
let submitted = 0;

function submitBatch(batch) {
  return new Promise((resolve) => {
    const data = JSON.stringify({
      host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList: batch,
    });
    const req = https.request({
      hostname: 'api.indexnow.org', path: '/indexnow', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        console.log(`  Batch ${submitted}~${submitted + batch.length}: HTTP ${res.statusCode}`);
        submitted += batch.length;
        resolve(res.statusCode);
      });
    });
    req.on('error', (e) => { console.error('  Error:', e.message); resolve(0); });
    req.write(data);
    req.end();
  });
}

(async () => {
  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);
    await submitBatch(batch);
  }
  console.log(`IndexNow完了: ${submitted}ページ送信`);
})();
