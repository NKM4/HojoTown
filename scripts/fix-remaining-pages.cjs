/**
 * 残りの市ページを一括修正:
 * 1. LifeEventBannerのimport追加
 * 2. 診断CTAの前にLifeEventBanner挿入
 * 3. 空タイトルを修正（title={} → 正しいタイトル）
 * 4. 空descriptionを修正
 * 5. カテゴリナビのhref修正（href={} → href={`#${cat}`}）
 */
const fs = require('fs');
const path = require('path');
const glob = require('glob');

const pagesDir = path.join(__dirname, '..', 'src', 'pages');
const pattern = path.join(pagesDir, '*', '*', 'index.astro').replace(/\\/g, '/');
const files = glob.sync(pattern);

let modified = 0;
let skipped = 0;

for (const file of files) {
  const relativePath = path.relative(pagesDir, file);
  // life/配下などは除外
  if (relativePath.startsWith('life') || relativePath.startsWith('compare') ||
      relativePath.startsWith('shindan') || relativePath.startsWith('d9k2m7x') ||
      relativePath.startsWith('about') || relativePath.startsWith('contact') ||
      relativePath.startsWith('privacy') || relativePath.startsWith('terms')) {
    continue;
  }

  let content = fs.readFileSync(file, 'utf-8');

  // 既にLifeEventBannerがあればスキップ
  if (content.includes('LifeEventBanner')) {
    skipped++;
    continue;
  }

  // categoriesUsedがない = 市ページではない
  if (!content.includes('categoriesUsed')) {
    skipped++;
    continue;
  }

  let changed = false;

  // 1. import追加
  if (!content.includes("import LifeEventBanner")) {
    // BaseLayoutのimportの次の行に追加
    const lines = content.split('\n');
    const baseLayoutIdx = lines.findIndex(l => l.includes("import BaseLayout from"));
    if (baseLayoutIdx >= 0) {
      lines.splice(baseLayoutIdx + 1, 0, "import LifeEventBanner from '../../../components/LifeEventBanner.astro';");
      content = lines.join('\n');
      changed = true;
    }
  }

  // 2. LifeEventBanner挿入（診断CTAの前 or 免責の前 or </section>の最後の前）
  const bannerCode = `      <!-- ライフイベント導線 -->\n      <LifeEventBanner categories={categoriesUsed} />\n\n`;

  if (content.includes('あなたに合った補助金を診断してみませんか')) {
    content = content.replace(
      /(\s*<div[^>]*>[\s\S]*?あなたに合った補助金を診断してみませんか)/,
      bannerCode + '$1'
    );
    changed = true;
  } else if (content.includes('近隣の市と比較してみませんか')) {
    content = content.replace(
      /(\s*<div[^>]*>[\s\S]*?近隣の市と比較してみませんか)/,
      bannerCode + '$1'
    );
    changed = true;
  } else if (content.includes('class="disclaimer"')) {
    content = content.replace(
      /(\s*<div class="disclaimer")/,
      bannerCode + '$1'
    );
    changed = true;
  }

  // 3. 空タイトル修正: title={} → 正しいタイトル
  if (content.includes('title={}')) {
    content = content.replace(
      'title={}',
      'title={`${cityName}の補助金・助成金一覧 | ホジョタウン`}'
    );
    changed = true;
  }

  // 4. 空description修正
  if (content.includes('description={}')) {
    content = content.replace(
      'description={}',
      'description={`${prefecture}${cityName}で個人が使える補助金・助成金を${totalCount}件掲載。`}'
    );
    changed = true;
  }

  // 5. カテゴリナビのhref修正
  if (content.includes('href={}')) {
    content = content.replace(/href=\{\}/g, 'href={`#${cat}`}');
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(file, content, 'utf-8');
    modified++;
  } else {
    skipped++;
  }
}

console.log(`Done! Modified: ${modified}, Skipped: ${skipped}`);
