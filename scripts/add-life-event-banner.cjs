/**
 * 全市ページ(index.astro)にLifeEventBannerを一括追加するスクリプト
 *
 * - import文を追加
 * - 比較CTAの前にLifeEventBannerコンポーネントを挿入
 * - categoriesUsedが既にあるページのみ対応
 */
const fs = require('fs');
const path = require('path');
const glob = require('glob');

// 全都道府県の市ページを取得
const pagesDir = path.join(__dirname, '..', 'src', 'pages');
const pattern = path.join(pagesDir, '*', '*', 'index.astro');

// globがWindowsパスでも動くよう修正
const files = glob.sync(pattern.replace(/\\/g, '/'));

let modified = 0;
let skipped = 0;
let errors = 0;

for (const file of files) {
  // life/配下、about、contactなどは除外
  const relativePath = path.relative(pagesDir, file);
  if (relativePath.startsWith('life') || relativePath.startsWith('compare') || relativePath.startsWith('shindan') || relativePath.startsWith('d9k2m7x')) {
    skipped++;
    continue;
  }

  try {
    let content = fs.readFileSync(file, 'utf-8');

    // 既にLifeEventBannerがあればスキップ
    if (content.includes('LifeEventBanner')) {
      skipped++;
      continue;
    }

    // categoriesUsedがあるか確認（市ページの証）
    if (!content.includes('categoriesUsed')) {
      skipped++;
      continue;
    }

    // 1. import文追加（BaseLayoutのimportの後に）
    if (content.includes("import BaseLayout from")) {
      content = content.replace(
        /(import BaseLayout from.*?;\n)/,
        `$1import LifeEventBanner from '../../../components/LifeEventBanner.astro';\n`
      );
    }

    // 2. 比較CTAの前にLifeEventBannerを挿入
    const bannerCode = `      <!-- ライフイベント導線 -->
      <LifeEventBanner categories={categoriesUsed} />

`;

    if (content.includes('<!-- 比較CTA -->')) {
      content = content.replace(
        '      <!-- 比較CTA -->',
        bannerCode + '      <!-- 比較CTA -->'
      );
      fs.writeFileSync(file, content, 'utf-8');
      modified++;
    } else {
      // 比較CTAがないページは免責の前に挿入
      if (content.includes('<!-- 免責 -->')) {
        content = content.replace(
          '      <!-- 免責 -->',
          bannerCode + '      <!-- 免責 -->'
        );
        fs.writeFileSync(file, content, 'utf-8');
        modified++;
      } else {
        console.log(`  SKIP (no insertion point): ${relativePath}`);
        skipped++;
      }
    }
  } catch (e) {
    console.error(`  ERROR: ${file}: ${e.message}`);
    errors++;
  }
}

console.log(`\nDone! Modified: ${modified}, Skipped: ${skipped}, Errors: ${errors}`);
