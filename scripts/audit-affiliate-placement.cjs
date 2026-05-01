#!/usr/bin/env node
/**
 * Affiliate placement audit.
 *
 * Checks that active ads use valid categories/events and that the important
 * A8 programs appear in the contexts where users naturally expect them.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const affiliatePath = path.join(root, 'src/data/affiliate.ts');
const typesPath = path.join(root, 'src/data/types.ts');

const affiliateSource = fs.readFileSync(affiliatePath, 'utf8');
const typesSource = fs.readFileSync(typesPath, 'utf8');

function extractUnionValues(source, typeName) {
  const match = source.match(new RegExp(`export type ${typeName}\\s*=([\\s\\S]*?);`));
  if (!match) throw new Error(`Cannot find union type: ${typeName}`);
  return [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

function getArrayBody(source, exportName) {
  const start = source.indexOf(`export const ${exportName}`);
  if (start === -1) throw new Error(`Cannot find array: ${exportName}`);
  const assignment = source.indexOf('=', start);
  const open = source.indexOf('[', assignment);
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '[') depth++;
    if (source[i] === ']') depth--;
    if (depth === 0) return source.slice(open + 1, i);
  }
  throw new Error(`Cannot parse array: ${exportName}`);
}

function splitObjects(arrayBody) {
  const objects = [];
  let start = -1;
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let i = 0; i < arrayBody.length; i++) {
    const ch = arrayBody[i];
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        objects.push(arrayBody.slice(start, i + 1));
        start = -1;
      }
    }
  }
  return objects;
}

function stringField(objectSource, field) {
  return objectSource.match(new RegExp(`${field}:\\s*'([^']*)'`))?.[1] ?? '';
}

function numberField(objectSource, field) {
  const raw = objectSource.match(new RegExp(`${field}:\\s*(-?\\d+)`))?.[1];
  return raw ? Number(raw) : 0;
}

function arrayField(objectSource, field) {
  const match = objectSource.match(new RegExp(`${field}:\\s*\\[([^\\]]*)\\]`));
  if (!match) return [];
  return [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

const validCategories = new Set(extractUnionValues(typesSource, 'Category'));
const validEvents = new Set(extractUnionValues(affiliateSource, 'LifeEvent'));
const ads = splitObjects(getArrayBody(affiliateSource, 'AFFILIATE_ADS')).map((source) => ({
  id: stringField(source, 'id'),
  title: stringField(source, 'title'),
  url: stringField(source, 'url'),
  triggerCategories: arrayField(source, 'triggerCategories'),
  lifeEvents: arrayField(source, 'lifeEvents'),
  priority: numberField(source, 'priority'),
}));

const errors = [];
const activeAds = ads.filter((ad) => ad.url.trim().length > 0);

for (const ad of ads) {
  if (!ad.id) errors.push('Ad without id');
  for (const category of ad.triggerCategories) {
    if (!validCategories.has(category)) {
      errors.push(`${ad.id}: invalid category ${category}`);
    }
  }
  for (const event of ad.lifeEvents) {
    if (!validEvents.has(event)) {
      errors.push(`${ad.id}: invalid life event ${event}`);
    }
  }
  if (ad.url && !/^https:\/\/px\.a8\.net\//.test(ad.url)) {
    errors.push(`${ad.id}: non-A8 active URL ${ad.url}`);
  }
  if (!ad.url && ad.priority !== 0) {
    errors.push(`${ad.id}: disabled ad must have priority 0`);
  }
}

function matchingAds(categories, count = 2) {
  return activeAds
    .filter((ad) => ad.triggerCategories.some((category) => categories.includes(category)))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, count);
}

function lifeEventAds(event, count = 3) {
  return activeAds
    .filter((ad) => ad.lifeEvents.includes(event))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, count);
}

function ids(list) {
  return list.map((ad) => ad.id);
}

function expectIncludes(context, list, expected) {
  for (const id of expected) {
    if (!list.includes(id)) errors.push(`${context}: missing ${id}; got ${list.join(', ') || '(none)'}`);
  }
}

function expectFirst(context, list, expected) {
  if (list[0] !== expected) errors.push(`${context}: expected first ${expected}; got ${list.join(', ') || '(none)'}`);
}

for (const event of validEvents) {
  if (lifeEventAds(event).length === 0) errors.push(`life/${event}: no active affiliate ad`);
}

expectIncludes('category childcare/birth/medical', ids(matchingAds(['childcare', 'birth', 'medical'])), ['childcare-insurance']);
expectFirst('category fertility', ids(matchingAds(['fertility'])), 'fertility-insurance');
expectFirst('category education', ids(matchingAds(['education'])), 'education-insurance');
expectFirst('category ev', ids(matchingAds(['ev'])), 'navikuru-car');
expectFirst('category solar', ids(matchingAds(['solar'])), 'griene-solar');
expectFirst('life/marriage', ids(lifeEventAds('marriage')), 'marriage-agency');
expectFirst('life/career', ids(lifeEventAds('career')), 'education-insurance');
expectIncludes('life/baby', ids(lifeEventAds('baby')), ['childcare-insurance', 'fertility-insurance']);

for (const ad of activeAds) {
  const inCategory = [...validCategories].some((category) => ids(matchingAds([category], 20)).includes(ad.id));
  const inEvent = [...validEvents].some((event) => ids(lifeEventAds(event, 20)).includes(ad.id));
  if (!inCategory && !inEvent) errors.push(`${ad.id}: active ad is unreachable`);
}

if (errors.length > 0) {
  console.error('Affiliate placement audit failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Affiliate placement audit OK: ${activeAds.length}/${ads.length} active ads`);
for (const event of validEvents) {
  console.log(`life/${event}: ${ids(lifeEventAds(event)).join(', ')}`);
}
