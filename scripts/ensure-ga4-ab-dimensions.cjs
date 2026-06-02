/**
 * GA4 custom dimensions required for AB test reporting.
 *
 * Requires either:
 *   GOOGLE_APPLICATION_CREDENTIALS - path to a service account JSON file
 *   GA4_SERVICE_ACCOUNT_KEY        - raw service account JSON, used in GitHub Actions
 */
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const GA4_PROPERTY_ID = '531123324';
const REQUIRED_DIMENSIONS = [
  {
    parameterName: 'ab_test',
    displayName: 'AB Test',
    description: 'HojoTown AB test name',
  },
  {
    parameterName: 'ab_variant',
    displayName: 'AB Variant',
    description: 'HojoTown AB test variant',
  },
];

async function main() {
  const tmpKey = path.join(__dirname, '..', '.ga4-tmp-key.json');
  let wroteKey = false;
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (!keyPath && !process.env.GA4_SERVICE_ACCOUNT_KEY) {
    console.log('GA4 credentials are not configured. Skipping custom dimension check.');
    return;
  }

  try {
    if (process.env.GA4_SERVICE_ACCOUNT_KEY && !keyPath) {
      fs.writeFileSync(tmpKey, process.env.GA4_SERVICE_ACCOUNT_KEY);
      process.env.GOOGLE_APPLICATION_CREDENTIALS = tmpKey;
      wroteKey = true;
    }

    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/analytics.edit'],
    });
    const analyticsAdmin = google.analyticsadmin({ version: 'v1beta', auth });
    const parent = `properties/${GA4_PROPERTY_ID}`;

    const existing = [];
    let pageToken = undefined;
    do {
      const res = await analyticsAdmin.properties.customDimensions.list({
        parent,
        pageSize: 200,
        pageToken,
      });
      existing.push(...(res.data.customDimensions || []));
      pageToken = res.data.nextPageToken;
    } while (pageToken);

    const existingParams = new Set(existing.map((dimension) => dimension.parameterName));
    for (const dimension of REQUIRED_DIMENSIONS) {
      if (existingParams.has(dimension.parameterName)) {
        console.log(`GA4 custom dimension exists: ${dimension.parameterName}`);
        continue;
      }

      await analyticsAdmin.properties.customDimensions.create({
        parent,
        requestBody: {
          ...dimension,
          scope: 'EVENT',
        },
      });
      console.log(`GA4 custom dimension created: ${dimension.parameterName}`);
    }
  } finally {
    if (wroteKey) {
      try { fs.unlinkSync(tmpKey); } catch (_) {}
    }
  }
}

main().catch((e) => {
  console.error('GA4 custom dimension check failed:', e.message);
  process.exit(1);
});
