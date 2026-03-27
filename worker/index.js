export default {
  async fetch(request, env) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    // POST /contact - フォーム送信
    if (request.method === 'POST' && url.pathname === '/contact') {
      try {
        const data = await request.json();
        await env.DB.prepare(
          'INSERT INTO contacts (type, name, email, message, city, created_at) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(
          data.type || 'contact',
          data.name || '',
          data.email || '',
          data.message || '',
          data.city || '',
          new Date().toISOString()
        ).run();

        return new Response(JSON.stringify({ status: 'ok' }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ status: 'error', message: e.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    // GET /contacts - 一覧取得（管理用・トークン必須）
    if (request.method === 'GET' && url.pathname === '/contacts') {
      const token = url.searchParams.get('token') || request.headers.get('Authorization')?.replace('Bearer ', '');
      if (token !== env.ADMIN_TOKEN) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      const results = await env.DB.prepare('SELECT * FROM contacts ORDER BY created_at DESC LIMIT 100').all();
      return new Response(JSON.stringify(results.results), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    return new Response('Not found', { status: 404, headers: corsHeaders });
  }
};
