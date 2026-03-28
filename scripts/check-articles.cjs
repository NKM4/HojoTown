const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, '..', 'src', 'pages');
const validCategories = [
  'childcare','birth','medical','reform','disability','elderly',
  'solar','fertility','vaccine','moving','marriage','education',
  'safety','vacant_house','appliance','ev','migration','utility',
  'pet','wifi','funeral','helmet','license_return','other'
];

// ファイル名→期待されるカテゴリのマッピング
const filenameCategoryMap = {
  'kosodate': ['childcare','birth','medical'],
  'reform': ['reform','vacant_house'],
  'taiyoko': ['solar','appliance','ev'],
  'sho-ene': ['solar','appliance'],
  'iryo': ['medical','childcare'],
  'shogaisha': ['disability'],
  'koureisha': ['elderly'],
  'funin': ['fertility'],
  'iju': ['moving','migration'],
  'kekkon': ['marriage'],
  'ninshin': ['birth','fertility'],
  'suidou': ['utility'],
  'hikaku': ['childcare'],
};

function findArticles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...findArticles(full));
    else if (entry.name.endsWith('.astro') && entry.name !== 'index.astro' && entry.name !== '404.astro') {
      results.push(full);
    }
  }
  return results;
}

const articles = findArticles(pagesDir);
let errors = 0;

console.log(`Checking ${articles.length} articles...\n`);

for (const file of articles) {
  const content = fs.readFileSync(file, 'utf8');
  const rel = path.relative(pagesDir, file);
  const checks = [];

  // 1. ArticleAds import
  if (!content.includes("import ArticleAds from")) {
    checks.push('MISSING ArticleAds import');
  }

  // 2. BaseLayout import
  if (!content.includes("import BaseLayout from")) {
    checks.push('MISSING BaseLayout import');
  }

  // 3. style tag
  if (!content.includes('<style>') && !content.includes('<style ')) {
    checks.push('MISSING <style> tag');
  }

  // 4. article-cta
  if (!content.includes('article-cta')) {
    checks.push('MISSING article-cta section');
  }

  // 5. disclaimer
  if (!content.includes('disclaimer')) {
    checks.push('MISSING disclaimer');
  }

  // 6. ArticleAds categories check
  const catMatch = content.match(/categories=\{(\[[^\]]+\])\}/);
  if (catMatch) {
    try {
      const cats = JSON.parse(catMatch[1].replace(/'/g, '"'));
      // Check all categories are valid
      for (const c of cats) {
        if (!validCategories.includes(c)) {
          checks.push(`INVALID category "${c}"`);
        }
      }
      // Check categories match filename
      const basename = path.basename(file, '.astro');
      for (const [key, expectedCats] of Object.entries(filenameCategoryMap)) {
        if (basename.includes(key)) {
          const hasOverlap = cats.some(c => expectedCats.includes(c));
          if (!hasOverlap) {
            checks.push(`CATEGORY MISMATCH: file=${basename}, categories=${JSON.stringify(cats)}, expected overlap with ${JSON.stringify(expectedCats)}`);
          }
          break;
        }
      }
    } catch {}
  } else {
    checks.push('MISSING ArticleAds categories');
  }

  // 7. h1 tag
  if (!content.includes('<h1')) {
    checks.push('MISSING <h1> tag');
  }

  // 8. article-toc
  if (!content.includes('article-toc')) {
    checks.push('MISSING article-toc');
  }

  if (checks.length > 0) {
    errors += checks.length;
    console.log(`FAIL ${rel}:`);
    for (const c of checks) console.log(`  - ${c}`);
  }
}

console.log(`\n--- Summary ---`);
console.log(`Articles: ${articles.length}`);
console.log(`Errors: ${errors}`);

if (errors > 0) process.exit(1);
else console.log('All articles OK');
