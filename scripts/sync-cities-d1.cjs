#!/usr/bin/env node
/**
 * cities.json → D1 同期スクリプト
 * deploy.sh から呼ばれる。cities.jsonの全データをD1のcitiesテーブルに同期。
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const CITIES_JSON = path.resolve(__dirname, '../src/data/cities.json');
const WRANGLER_DIR = path.resolve(__dirname, '../worker');

const cities = JSON.parse(fs.readFileSync(CITIES_JSON, 'utf-8'));
console.log(`cities.json: ${cities.length}件`);

// DROP + CREATE で完全同期（差分ではなく毎回全入れ替え）
const statements = [
  'DROP TABLE IF EXISTS cities;',
  'CREATE TABLE cities (slug TEXT PRIMARY KEY, code TEXT, name TEXT, prefecture TEXT);',
];

// バッチINSERT (50件ずつ)
const batchSize = 50;
for (let i = 0; i < cities.length; i += batchSize) {
  const batch = cities.slice(i, i + batchSize);
  const values = batch.map(c => {
    const name = c.name.replace(/'/g, "''");
    const pref = c.prefecture.replace(/'/g, "''");
    const slug = c.slug.replace(/'/g, "''");
    return `('${slug}','${c.code}','${name}','${pref}')`;
  }).join(',');
  statements.push(`INSERT INTO cities (slug, code, name, prefecture) VALUES ${values};`);
}

// 一時SQLファイルに書き出し
const tmpSql = path.resolve(__dirname, '../.cities-sync.sql');
fs.writeFileSync(tmpSql, statements.join('\n'), 'utf-8');

try {
  const result = execSync(
    `npx wrangler d1 execute hojotown-contacts --remote --file="${tmpSql}" --yes`,
    { cwd: WRANGLER_DIR, stdio: 'pipe', timeout: 30000 }
  );
  const output = result.toString();
  // 件数確認
  const verifyResult = execSync(
    `npx wrangler d1 execute hojotown-contacts --remote --command="SELECT COUNT(*) as cnt FROM cities;"`,
    { cwd: WRANGLER_DIR, stdio: 'pipe', timeout: 15000 }
  );
  const countMatch = verifyResult.toString().match(/"cnt":\s*(\d+)/);
  const count = countMatch ? parseInt(countMatch[1]) : '?';
  console.log(`D1同期完了: ${count}件 (期待値: ${cities.length}件)`);
  if (count !== cities.length) {
    console.error(`⚠️ 件数不一致! D1: ${count} / JSON: ${cities.length}`);
    process.exit(1);
  }
} catch (e) {
  console.error('D1同期エラー:', e.message);
  process.exit(1);
} finally {
  // 一時ファイル削除
  try { fs.unlinkSync(tmpSql); } catch (_) {}
}
