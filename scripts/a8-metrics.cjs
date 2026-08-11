const fs = require('fs');

function parseNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const normalized = String(value).replace(/[,\s円件]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeMetrics(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const metricKeys = [
    'conversions', 'conversionCount', 'approvedCount', 'salesCount',
    'pending', 'pendingCount', 'unapprovedCount',
    'revenue', 'reward', 'commission', 'approvedReward', 'clicks',
  ];
  if (!metricKeys.some((key) => Object.hasOwn(raw, key))) {
    throw new Error('A8 metrics JSON does not contain any supported metric keys');
  }
  const conversions = parseNumber(raw.conversions ?? raw.conversionCount ?? raw.approvedCount ?? raw.salesCount);
  const pending = parseNumber(raw.pending ?? raw.pendingCount ?? raw.unapprovedCount);
  const revenue = parseNumber(raw.revenue ?? raw.reward ?? raw.commission ?? raw.approvedReward);
  const clicks = raw.clicks === undefined ? null : parseNumber(raw.clicks);
  return {
    source: raw.source || 'manual',
    range: raw.range || raw.period || '',
    conversions,
    pending,
    revenue,
    clicks,
    updatedAt: raw.updatedAt || raw.updated_at || new Date().toISOString(),
    unavailable: false,
  };
}

function readA8Metrics(env = process.env) {
  try {
    if (env.A8_METRICS_JSON) {
      return normalizeMetrics(JSON.parse(env.A8_METRICS_JSON));
    }
    if (env.A8_METRICS_FILE && fs.existsSync(env.A8_METRICS_FILE)) {
      return normalizeMetrics(JSON.parse(fs.readFileSync(env.A8_METRICS_FILE, 'utf8')));
    }
  } catch (e) {
    return {
      source: 'error',
      range: '',
      conversions: 0,
      pending: 0,
      revenue: 0,
      clicks: null,
      updatedAt: new Date().toISOString(),
      unavailable: true,
      error: e.message,
    };
  }
  return {
    source: 'not_configured',
    range: '',
    conversions: 0,
    pending: 0,
    revenue: 0,
    clicks: null,
    updatedAt: '',
    unavailable: true,
  };
}

function formatCurrency(value) {
  return `${Math.round(parseNumber(value)).toLocaleString('ja-JP')}円`;
}

module.exports = {
  readA8Metrics,
  formatCurrency,
};
