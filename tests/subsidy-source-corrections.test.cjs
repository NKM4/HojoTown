const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const root = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const cities = ['arakawa', 'asahikawa', 'ashikaga', 'hanno', 'hino', 'iwaki', 'omihachiman', 'sendai'];
const records = cities.flatMap(city => JSON.parse(read(`src/data/subsidies/${city}.json`)));
const get = id => {
  const record = records.find(record => record.id === id);
  assert.ok(record, `Missing record: ${id}`);
  return record;
};

// Snapshot of official-source corrections verified on 2026-10-03.
// Update these expectations with source evidence when the schemes change.
test('affected records retain the existing data schema and unique IDs', () => {
  const ids = new Set();
  for (const record of records) {
    assert.ok(!ids.has(record.id), `Duplicate ID: ${record.id}`);
    ids.add(record.id);
    for (const key of ['id', 'name', 'category', 'cityCode', 'cityName', 'prefecture', 'summary', 'target', 'amount', 'deadline', 'officialUrl', 'lastUpdated']) {
      assert.equal(typeof record[key], 'string', `${record.id}.${key}`);
      assert.ok(record[key].length > 0, `${record.id}.${key}`);
    }
    assert.ok(['active', 'ended', 'upcoming'].includes(record.status));
    assert.ok(Number.isFinite(record.maxAmount) && record.maxAmount >= 0);
    assert.equal(new URL(record.officialUrl).protocol, 'https:');
    assert.match(record.lastUpdated, /^\d{4}-\d{2}-\d{2}$/);
  }
});

test('birth records describe successor schemes without a false fixed maximum', () => {
  for (const id of ['arakawa-birth-001', 'ashikaga-birth-001']) {
    const record = get(id);
    assert.match(record.name, /妊婦/);
    assert.match(record.amount, /胎児1人につき5万円/);
    assert.match(record.amount, /単胎/);
    assert.equal(record.maxAmount, 0); // Unknown overall maximum uses the existing schema sentinel.
    assert.equal(record.status, 'active');
    assert.match(record.summary, /2025年4月/);
  }
  assert.match(get('ashikaga-birth-001').summary, /2026年3月30日で終了/);
  assert.match(get('ashikaga-birth-001').deadline, /2年/);
});

test('ended intake is excluded from active results and visible in city-page text', () => {
  const active = records.filter(record => record.status === 'active');
  for (const id of ['hino-helmet-001', 'iwaki-reform-001']) {
    const record = get(id);
    assert.equal(record.status, 'ended');
    assert.ok(!active.some(record => record.id === id));
    assert.match(record.name, /受付終了/);
    assert.match(record.summary, /終了/);
  }
  assert.doesNotMatch(get('hino-helmet-001').amount, /半額/);
  assert.match(get('hino-helmet-001').deadline, /2024年3月31日/);
  assert.equal(get('iwaki-reform-001').maxAmount, 150000);
  assert.match(get('iwaki-reform-001').deadline, /2026年9月30日/);
  assert.doesNotMatch(get('iwaki-reform-001').summary, /廃止/);
});

test('Omihachiman has program-specific sources and no unsupported migration record', () => {
  const expectedPaths = {
    'omihachiman-childcare-001': '/soshiki/shien/tanjyou/1535.html',
    'omihachiman-reform-001': '/kurashi/sumai/12/20644.html',
    'omihachiman-solar-001': '/news/41371.html',
    'omihachiman-marriage-001': '/soshiki/kikaku/konkatsu/40936.html',
  };
  for (const [id, expectedPath] of Object.entries(expectedPaths)) {
    assert.equal(new URL(get(id).officialUrl).pathname, expectedPath);
  }
  assert.ok(!records.some(record => record.id === 'omihachiman-migration-001'));
  assert.equal(get('omihachiman-reform-001').maxAmount, 1150000);
  assert.match(get('omihachiman-reform-001').deadline, /市に確認/);
  const solar = get('omihachiman-solar-001');
  assert.equal(solar.maxAmount, 150000);
  assert.match(solar.amount, /最も低い額/);
  assert.match(solar.deadline, /2027年2月26日/);
  assert.equal(solar.status, 'active');
  assert.match(get('omihachiman-marriage-001').amount, /夫婦とも婚姻時29歳以下/);
  assert.match(get('omihachiman-marriage-001').target, /所得500万円未満/);
});

test('Hanno rates and Sendai general source are current; Asahikawa valid URL is retained', () => {
  assert.equal(get('hanno-childcare-002').maxAmount, 48050);
  assert.match(get('hanno-childcare-002').amount, /11,340〜48,050円/);
  assert.match(get('hanno-childcare-002').amount, /5,680〜11,350円/);
  assert.match(get('hanno-childcare-001').officialUrl, /teatesoumu\/10140\.html$/);
  assert.match(get('sendai-elderly-001').officialUrl, /joshasho\/index\.html$/);
  assert.equal(get('asahikawa-medical-002').officialUrl, 'https://www.city.asahikawa.hokkaido.jp/kurashi/135/171/177/p004494.html');
});

test('hard-coded article sections agree with the corrected records', () => {
  const articles = {
    'tochigi/ashikaga': ['ashikaga-birth-001'],
    'saitama/hanno': ['hanno-childcare-001', 'hanno-childcare-002'],
    'shiga/omihachiman': ['omihachiman-childcare-001'],
  };
  for (const [cityPath, ids] of Object.entries(articles)) {
    const article = read(`src/pages/${cityPath}/kosodate-hojokin.astro`);
    for (const id of ids) {
      for (const field of ['officialUrl', 'amount', 'target']) {
        assert.ok(article.includes(get(id)[field]), `${cityPath} must include ${id}.${field}`);
      }
    }
  }
});
