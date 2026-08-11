const fs = require('fs');
const { spawnSync } = require('child_process');
const { readA8Metrics } = require('./a8-metrics.cjs');

const file = process.argv[2];
const apply = process.argv.includes('--apply');

if (!file) {
  console.error('Usage: node scripts/update-a8-metrics-secret.cjs <metrics.json> [--apply]');
  process.exit(2);
}

let raw;
try {
  raw = fs.readFileSync(file, 'utf8');
} catch (error) {
  console.error(`A8 metrics file could not be read: ${error.message}`);
  process.exit(1);
}

const metrics = readA8Metrics({ A8_METRICS_JSON: raw });
if (metrics.unavailable) {
  console.error(`A8 metrics validation failed: ${metrics.error || 'unknown error'}`);
  process.exit(1);
}

const secret = JSON.stringify({
  source: metrics.source,
  range: metrics.range,
  conversions: metrics.conversions,
  pending: metrics.pending,
  revenue: metrics.revenue,
  clicks: metrics.clicks,
  updatedAt: metrics.updatedAt,
});

if (!apply) {
  console.log('A8 metrics validated. Re-run with --apply to update the GitHub Secret.');
  process.exit(0);
}

const result = spawnSync(
  process.platform === 'win32' ? 'gh.exe' : 'gh',
  ['secret', 'set', 'A8_METRICS_JSON', '--repo', 'NKM4/HojoTown'],
  { input: secret, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
);

if (result.status !== 0) {
  console.error(`GitHub Secret update failed: ${(result.stderr || '').trim() || 'gh exited with an error'}`);
  process.exit(result.status || 1);
}

console.log('A8_METRICS_JSON was updated without printing its value.');
