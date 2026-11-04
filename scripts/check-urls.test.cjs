const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { checkUrl } = require('./check-urls.cjs');

test('GETで表示できるページをHEADだけでリンク切れと判定しない', async () => {
  const server = http.createServer((request, response) => {
    const headStatus = request.url === '/head-404' ? 404 : 503;
    response.writeHead(request.method === 'HEAD' ? headStatus : 200);
    response.end();
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    assert.equal(await checkUrl(`${base}/head-404`), 200);
    assert.equal(await checkUrl(`${base}/head-503`), 200);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('GETでも404のページはリンク切れとして残す', async () => {
  const server = http.createServer((_request, response) => {
    response.writeHead(404);
    response.end();
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const url = `http://127.0.0.1:${server.address().port}/missing`;
    assert.equal(await checkUrl(url), 404);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
