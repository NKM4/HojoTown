// Discord Webhook にエラーを通知
async function notifyError(env, error, context = '') {
  const webhookUrl = env.WEBHOOK_ERROR;
  if (!webhookUrl) return;
  try {
    const embed = {
      title: 'Worker エラー発生',
      color: 0xff0000,
      fields: [
        { name: 'エラー', value: (error.message || String(error)).substring(0, 1000) },
        { name: 'コンテキスト', value: context || 'なし', inline: true },
      ],
      timestamp: new Date().toISOString(),
    };
    if (error.stack) {
      embed.fields.push({ name: 'スタック', value: error.stack.substring(0, 1000) });
    }
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    });
  } catch (_) {
    // 通知自体の失敗は無視
  }
}

export default {
  async fetch(request, env) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': 'https://hojotown.jp',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    // POST /contact - フォーム送信
    if (request.method === 'POST' && url.pathname === '/contact') {
      try {
        const data = await request.json();
        const type = data.type || 'contact';
        const now = new Date().toISOString();
        await env.DB.prepare(
          'INSERT INTO contacts (type, name, email, message, city, created_at) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(type, data.name || '', data.email || '', data.message || '', data.city || '', now).run();

        // Discord通知
        const webhooks = {
          contact: env.WEBHOOK_CONTACT,
          info_error: env.WEBHOOK_CONTACT,
          feature_request: env.WEBHOOK_CONTACT,
          bug: env.WEBHOOK_CONTACT,
          other: env.WEBHOOK_CONTACT,
          city_request: env.WEBHOOK_CITY_REQUEST,
        };
        const webhookUrl = webhooks[type] || env.WEBHOOK_CONTACT;
        if (webhookUrl) {
          const labels = {contact:'お問い合わせ',info_error:'情報修正',feature_request:'機能要望',bug:'不具合',other:'その他',city_request:'市リクエスト'};
          const embed = {
            title: labels[type] || type,
            color: type === 'city_request' ? 0x1a5c3a : 0xc8a84b,
            fields: [],
            timestamp: now,
          };
          if (data.name) embed.fields.push({name:'名前',value:data.name,inline:true});
          if (data.email) embed.fields.push({name:'メール',value:data.email,inline:true});
          if (data.city) embed.fields.push({name:'市区町村',value:data.city,inline:true});
          if (data.message) embed.fields.push({name:'内容',value:data.message.substring(0,1000)});
          await fetch(webhookUrl, {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({embeds:[embed]})
          }).catch(()=>{});
        }

        return new Response(JSON.stringify({ status: 'ok' }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch (e) {
        await notifyError(env, e, 'POST /contact');
        return new Response(JSON.stringify({ status: 'error', message: e.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    // GET /contacts - 一覧取得（Google認証）
    if (request.method === 'GET' && url.pathname === '/contacts') {
      const token = request.headers.get('Authorization')?.replace('Bearer ', '');
      if (!token) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      try {
        const res = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + token);
        const info = await res.json();
        if (info.email !== 'hojotown2026@gmail.com' && info.email !== 'taitatu4barisuta@gmail.com') {
          return new Response(JSON.stringify({ error: 'Forbidden' }), {
            status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }
      } catch (e) {
        await notifyError(env, e, 'GET /contacts - token validation');
        return new Response(JSON.stringify({ error: 'Invalid token' }), {
          status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      try {
        const results = await env.DB.prepare('SELECT * FROM contacts ORDER BY created_at DESC LIMIT 100').all();
        return new Response(JSON.stringify(results.results), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch (e) {
        await notifyError(env, e, 'GET /contacts - DB query');
        return new Response(JSON.stringify({ error: 'DB error' }), {
          status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    return new Response('Not found', { status: 404, headers: corsHeaders });
  }
};
