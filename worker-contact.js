export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': 'https://hojotown.jp',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      const data = await request.json();
      const row = [
        new Date().toISOString(),
        data.type || 'contact',
        data.name || '',
        data.email || '',
        data.message || '',
        data.city || ''
      ];

      // KVに保存
      const key = `contact_${Date.now()}`;
      await env.CONTACTS.put(key, JSON.stringify(row), { expirationTtl: 86400 * 365 });

      return new Response(JSON.stringify({ status: 'ok' }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': 'https://hojotown.jp',
        }
      });
    } catch (e) {
      return new Response(JSON.stringify({ status: 'error', message: e.message }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': 'https://hojotown.jp',
        }
      });
    }
  }
};
