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
        if (info.email !== 'taitatu4barisuta@gmail.com' && info.email !== 'taitatu4alexandros@gmail.com') {
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

    // POST /line/webhook - LINE Messaging API Webhook
    if (request.method === 'POST' && url.pathname === '/line/webhook') {
      try {
        const body = await request.text();
        // 署名検証
        const signature = request.headers.get('x-line-signature');
        if (!signature || !env.LINE_CHANNEL_SECRET) {
          return new Response('Unauthorized', { status: 401 });
        }
        const key = await crypto.subtle.importKey(
          'raw', new TextEncoder().encode(env.LINE_CHANNEL_SECRET),
          { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
        );
        const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
        const expected = btoa(String.fromCharCode(...new Uint8Array(sig)));
        if (expected !== signature) {
          return new Response('Invalid signature', { status: 403 });
        }

        const data = JSON.parse(body);
        for (const event of data.events || []) {
          if (event.type === 'follow') {
            // 友だち追加時: DBに登録 + ウェルカムメッセージ
            const userId = event.source.userId;
            const now = new Date().toISOString();
            await env.DB.prepare(
              'INSERT OR IGNORE INTO line_users (user_id, followed_at, updated_at) VALUES (?, ?, ?)'
            ).bind(userId, now, now).run();
            await lineReply(env, event.replyToken, [
              { type: 'text', text: '友だち追加ありがとうございます！🏠\nホジョタウンは、あなたの街の補助金を30秒で検索できるサービスです。' },
              { type: 'text', text: '📍 お住まいの市区町村名を送信すると、補助金の更新通知をお届けします。\n\n例: 「名古屋市」「世田谷区」' },
            ]);
          } else if (event.type === 'message' && event.message.type === 'text') {
            const userId = event.source.userId;
            const text = event.message.text.trim();
            // 市区町村登録を試みる
            const cityMatch = await findCity(env, text);
            if (cityMatch) {
              const now = new Date().toISOString();
              await env.DB.prepare(
                'INSERT INTO line_users (user_id, city_code, city_name, prefecture, followed_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET city_code=?, city_name=?, prefecture=?, updated_at=?'
              ).bind(userId, cityMatch.code, cityMatch.name, cityMatch.pref, now, now, cityMatch.code, cityMatch.name, cityMatch.pref, now).run();
              await lineReply(env, event.replyToken, [
                { type: 'text', text: `✅ ${cityMatch.pref}${cityMatch.name}を登録しました！\n\n補助金情報に更新があればお知らせします。\n\n🔍 診断はこちら:\nhttps://hojotown.jp/shindan/` },
              ]);
            } else {
              await lineReply(env, event.replyToken, [
                { type: 'text', text: `「${text}」に該当する市区町村が見つかりませんでした。\n\n正式名称で入力してみてください。\n例: 「名古屋市」「横浜市」「世田谷区」` },
              ]);
            }
          } else if (event.type === 'unfollow') {
            await env.DB.prepare('DELETE FROM line_users WHERE user_id = ?').bind(event.source.userId).run();
          }
        }
        return new Response('OK', { status: 200 });
      } catch (e) {
        await notifyError(env, e, 'POST /line/webhook');
        return new Response('OK', { status: 200 }); // LINEには200を返す
      }
    }

    // POST /line/push - 補助金更新通知（GitHub Actions等から呼ぶ、シークレットで認証）
    if (request.method === 'POST' && url.pathname === '/line/push') {
      const authHeader = request.headers.get('Authorization');
      if (authHeader !== `Bearer ${env.LINE_CHANNEL_SECRET}`) {
        return new Response('Unauthorized', { status: 401 });
      }
      try {
        const { message, city_code } = await request.json();
        let users;
        if (city_code) {
          users = await env.DB.prepare('SELECT user_id FROM line_users WHERE city_code = ?').bind(city_code).all();
        } else {
          users = await env.DB.prepare('SELECT user_id FROM line_users WHERE user_id IS NOT NULL').all();
        }
        let sent = 0;
        for (const user of users.results || []) {
          await linePush(env, user.user_id, [{ type: 'text', text: message }]);
          sent++;
        }
        return new Response(JSON.stringify({ sent }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (e) {
        await notifyError(env, e, 'POST /line/push');
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
      }
    }

    // GET /line/users - 登録ユーザー一覧（管理用、シークレット認証）
    if (request.method === 'GET' && url.pathname === '/line/users') {
      const authHeader = request.headers.get('Authorization');
      if (authHeader !== `Bearer ${env.LINE_CHANNEL_SECRET}`) {
        return new Response('Unauthorized', { status: 401 });
      }
      const results = await env.DB.prepare('SELECT * FROM line_users ORDER BY updated_at DESC').all();
      return new Response(JSON.stringify(results.results), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response('Not found', { status: 404, headers: corsHeaders });
  }
};

// LINE API helpers
async function lineReply(env, replyToken, messages) {
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.LINE_CHANNEL_TOKEN}`,
    },
    body: JSON.stringify({ replyToken, messages }),
  });
}

async function linePush(env, userId, messages) {
  await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.LINE_CHANNEL_TOKEN}`,
    },
    body: JSON.stringify({ to: userId, messages }),
  });
}

// 市区町村検索（テキストから）
async function findCity(env, text) {
  const cityName = text.trim();
  const cleaned = cityName.replace(/[市区町村]$/g, '').trim();
  // 完全一致
  const exact = await env.DB.prepare(
    "SELECT code, name, prefecture FROM cities WHERE name = ? LIMIT 1"
  ).bind(cityName).all();
  if (exact.results && exact.results.length > 0) {
    const r = exact.results[0];
    return { code: r.code, name: r.name, pref: r.prefecture };
  }
  // 「市」を付けて検索
  const withSuffix = await env.DB.prepare(
    "SELECT code, name, prefecture FROM cities WHERE name = ? OR name = ? OR name = ? LIMIT 1"
  ).bind(cleaned + '市', cleaned + '区', cleaned + '町').all();
  if (withSuffix.results && withSuffix.results.length > 0) {
    const r = withSuffix.results[0];
    return { code: r.code, name: r.name, pref: r.prefecture };
  }
  // 部分一致
  const partial = await env.DB.prepare(
    "SELECT code, name, prefecture FROM cities WHERE name LIKE ? LIMIT 1"
  ).bind('%' + cleaned + '%').all();
  if (partial.results && partial.results.length > 0) {
    const r = partial.results[0];
    return { code: r.code, name: r.name, pref: r.prefecture };
  }
  return null;
}
