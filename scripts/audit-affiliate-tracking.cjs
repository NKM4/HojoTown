#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const files = [
  'src/layouts/BaseLayout.astro',
  'src/components/ArticleAds.astro',
  'src/components/LifeEventLP.astro',
  'src/components/ShindanForm.tsx',
].map((file) => path.join(root, file));

const errors = [];
for (const file of files) {
  if (!fs.existsSync(file)) {
    errors.push(`missing file: ${path.relative(root, file)}`);
  }
}

const base = fs.existsSync(files[0]) ? fs.readFileSync(files[0], 'utf8') : '';
if (!base.includes("window.gtag('event', 'affiliate_click'")) {
  errors.push('BaseLayout: affiliate_click GA4 event is missing');
}
if (!base.includes('window.gtag = function()')) {
  errors.push('BaseLayout: window.gtag global assignment is missing');
}
if (!base.includes("event: 'hojotown_affiliate_click'")) {
  errors.push('BaseLayout: dataLayer affiliate event is missing');
}
if (!base.includes("anchor.matches('[data-ad-id]')") || !base.includes("linkDomain === 'px.a8.net'")) {
  errors.push('BaseLayout: affiliate link detection is incomplete');
}
if (!base.includes('anchor.dataset.affiliateTracked')) {
  errors.push('BaseLayout: duplicate click guard is missing');
}

for (const file of files.slice(1)) {
  if (!fs.existsSync(file)) continue;
  const source = fs.readFileSync(file, 'utf8');
  const hasAffiliateUrl = /href=\{ad\.url\}|href={ad\.url}/.test(source);
  if (!hasAffiliateUrl) continue;
  const rel = path.relative(root, file);
  for (const attr of ['data-ad-id', 'data-source', 'data-position']) {
    if (!source.includes(attr)) errors.push(`${rel}: ${attr} missing on affiliate links`);
  }
}

if (errors.length) {
  console.error('Affiliate tracking audit failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('Affiliate tracking audit OK');
