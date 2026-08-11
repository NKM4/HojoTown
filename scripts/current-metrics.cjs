const fs = require('fs');
const path = require('path');
const { readA8Metrics } = require('./a8-metrics.cjs');

const GA4_PROPERTY_ID = '531123324';
const tmpKey = path.join(__dirname, '..', '.ga4-tmp-key.json');

async function main() {
  let wroteKey = false;
  try {
    if (process.env.GA4_SERVICE_ACCOUNT_KEY && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      fs.writeFileSync(tmpKey, process.env.GA4_SERVICE_ACCOUNT_KEY);
      process.env.GOOGLE_APPLICATION_CREDENTIALS = tmpKey;
      wroteKey = true;
    }
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      throw new Error('GA4 credentials are not configured');
    }

    const { BetaAnalyticsDataClient } = require('@google-analytics/data');
    const client = new BetaAnalyticsDataClient();
    const dateRange = {
      startDate: process.env.METRICS_START_DATE || '7daysAgo',
      endDate: process.env.METRICS_END_DATE || 'today',
    };

    const [summaryResponse] = await client.runReport({
      property: `properties/${GA4_PROPERTY_ID}`,
      metrics: [
        { name: 'activeUsers' },
        { name: 'screenPageViews' },
        { name: 'sessions' },
      ],
      dateRanges: [dateRange],
    });
    const summary = summaryResponse.rows?.[0]?.metricValues || [];

    const [clickResponse] = await client.runReport({
      property: `properties/${GA4_PROPERTY_ID}`,
      dimensions: [{ name: 'eventName' }],
      metrics: [{ name: 'eventCount' }],
      dateRanges: [dateRange],
      dimensionFilter: {
        filter: { fieldName: 'eventName', stringFilter: { value: 'affiliate_click' } },
      },
    });

    let adBreakdownAvailable = true;
    let adBreakdownError = '';
    const [clickByAdResponse] = await client.runReport({
      property: `properties/${GA4_PROPERTY_ID}`,
      dimensions: [{ name: 'customEvent:ad_id' }],
      metrics: [{ name: 'eventCount' }],
      dateRanges: [dateRange],
      dimensionFilter: {
        filter: { fieldName: 'eventName', stringFilter: { value: 'affiliate_click' } },
      },
      orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
      limit: 10,
    }).catch((error) => {
      adBreakdownAvailable = false;
      adBreakdownError = error.message;
      return [{ rows: [] }];
    });

    const metrics = {
      range: `${dateRange.startDate}..${dateRange.endDate}`,
      activeUsers: summary[0]?.value || '0',
      pageViews: summary[1]?.value || '0',
      sessions: summary[2]?.value || '0',
      affiliateClicks: clickResponse.rows?.[0]?.metricValues?.[0]?.value || '0',
      affiliateConversions: readA8Metrics(),
      adBreakdownAvailable,
      adBreakdownError,
      topAffiliateClicks: (clickByAdResponse.rows || []).map((row) => ({
        adId: row.dimensionValues?.[0]?.value || '(not set)',
        clicks: row.metricValues?.[0]?.value || '0',
      })),
    };

    console.log('HOJOTOWN_CURRENT_METRICS ' + JSON.stringify(metrics));
  } finally {
    if (wroteKey) {
      try { fs.unlinkSync(tmpKey); } catch (_) {}
    }
  }
}

main().catch((e) => {
  console.error('current metrics failed:', e.message);
  process.exit(1);
});
