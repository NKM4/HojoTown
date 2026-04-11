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
            const userId = event.source.userId;
            const now = new Date().toISOString();
            await env.DB.prepare(
              'INSERT OR IGNORE INTO line_users (user_id, followed_at, updated_at) VALUES (?, ?, ?)'
            ).bind(userId, now, now).run();
            await lineReply(env, event.replyToken, [
              welcomeFlexMessage(),
            ]);
          } else if (event.type === 'message' && event.message.type === 'text') {
            const userId = event.source.userId;
            const text = event.message.text.trim();

            // コマンド処理
            if (['解除', 'リセット', '全解除', 'クリア'].includes(text)) {
              await env.DB.prepare('DELETE FROM line_user_cities WHERE user_id = ?').bind(userId).run();
              await lineReply(env, event.replyToken, [
                { type: 'text', text: '🗑️ 登録した市区町村をすべて解除しました。\n\nまた市名を送信すれば再登録できます。' },
              ]);
            } else if (['確認', '登録情報', 'マイページ', '一覧'].includes(text)) {
              const cities = await env.DB.prepare('SELECT city_name, prefecture FROM line_user_cities WHERE user_id = ? ORDER BY registered_at').bind(userId).all();
              if (cities.results && cities.results.length > 0) {
                const list = cities.results.map((c, i) => `${i + 1}. ${c.prefecture}${c.city_name}`).join('\n');
                await lineReply(env, event.replyToken, [
                  { type: 'text', text: `📋 登録中の市区町村（${cities.results.length}件）:\n\n${list}\n\n🗑️ 個別解除: 「○○市 解除」\n🗑️ 全解除: 「解除」` },
                ]);
              } else {
                await lineReply(env, event.replyToken, [
                  { type: 'text', text: '📋 登録中の市区町村はありません。\n\n市名を送信すると通知を受け取れます。\n例: 「名古屋市」「世田谷区」' },
                ]);
              }
            } else if (text.endsWith('解除') && text.length > 2) {
              // 個別解除: 「名古屋市 解除」「名古屋市���除」
              const cityText = text.replace(/\s*解除$/, '').trim();
              const cityMatch = await findCity(env, cityText);
              if (cityMatch) {
                const del = await env.DB.prepare('DELETE FROM line_user_cities WHERE user_id = ? AND city_code = ?').bind(userId, cityMatch.code).run();
                await lineReply(env, event.replyToken, [
                  { type: 'text', text: `🗑️ ${cityMatch.pref}${cityMatch.name}の通知を解除しました。` },
                ]);
              } else {
                await lineReply(env, event.replyToken, [
                  { type: 'text', text: `「${cityText}」が見つかりませんでした。「確認」で登録一覧を確認できます。` },
                ]);
              }
            } else if (['ヘルプ', 'help', '使い方'].includes(text)) {
              await lineReply(env, event.replyToken, [
                helpFlexMessage(),
              ]);
            } else if (['診断', 'しんだん'].includes(text)) {
              await lineReply(env, event.replyToken, [
                { type: 'text', text: '🔍 あなたがもらえる補助金を30秒で診断！\n\nhttps://hojotown.jp/shindan/' },
              ]);
            } else if (text.startsWith('診断結果を送信')) {
              // 診断結果送信: テキストから市名を抽出して補助金カードを返信
              const cityLine = text.split('\n').find(l => l.startsWith('市:'));
              const cityName = cityLine ? cityLine.replace('市:', '').trim() : '';
              const countLine = text.split('\n').find(l => l.startsWith('件数:'));
              const countText = countLine ? countLine.replace('件数:', '').replace('件', '').trim() : '0';
              const amountLine = text.split('\n').find(l => l.startsWith('最大合計:'));
              const amountText = amountLine ? amountLine.replace('最大合計:', '').replace('円', '').trim() : '0';

              if (cityName) {
                const cityMatch = await findCity(env, cityName);
                if (cityMatch) {
                  // 市の通知も自動登録
                  const now = new Date().toISOString();
                  const exists = await env.DB.prepare('SELECT 1 FROM line_user_cities WHERE user_id = ? AND city_code = ?').bind(userId, cityMatch.code).all();
                  if (!(exists.results && exists.results.length > 0)) {
                    await env.DB.prepare(
                      'INSERT INTO line_user_cities (user_id, city_code, city_name, prefecture, registered_at) VALUES (?, ?, ?, ?, ?)'
                    ).bind(userId, cityMatch.code, cityMatch.name, cityMatch.pref, now).run();
                    await env.DB.prepare(
                      'INSERT OR IGNORE INTO line_users (user_id, followed_at, updated_at) VALUES (?, ?, ?)'
                    ).bind(userId, now, now).run();
                  }
                  await lineReply(env, event.replyToken, [
                    shindanResultFlexMessage(cityMatch.pref, cityMatch.name, countText, amountText),
                  ]);
                } else {
                  await lineReply(env, event.replyToken, [
                    { type: 'text', text: `「${cityName}」の補助金情報が見つかりませんでした。\n\n正式名称（例: 名古屋市）で「診断」を再度お試しください。\n\nhttps://hojotown.jp/shindan/` },
                  ]);
                }
              } else {
                await lineReply(env, event.replyToken, [
                  { type: 'text', text: '診断結果の読み取りに失敗しました。\n\nもう一度診断を行ってください。\nhttps://hojotown.jp/shindan/' },
                ]);
              }
            } else {
              // 市区町村登録を試みる
              const cityMatch = await findCity(env, text);
              if (cityMatch) {
                const now = new Date().toISOString();
                // 重複チェック
                const exists = await env.DB.prepare('SELECT 1 FROM line_user_cities WHERE user_id = ? AND city_code = ?').bind(userId, cityMatch.code).all();
                if (exists.results && exists.results.length > 0) {
                  await lineReply(env, event.replyToken, [
                    { type: 'text', text: `${cityMatch.pref}${cityMatch.name}は既に登録済みです。\n\n📋 「確認」で登録一覧を表示\n🗑️ 「${cityMatch.name} 解除」で解除` },
                  ]);
                } else {
                  await env.DB.prepare(
                    'INSERT INTO line_user_cities (user_id, city_code, city_name, prefecture, registered_at) VALUES (?, ?, ?, ?, ?)'
                  ).bind(userId, cityMatch.code, cityMatch.name, cityMatch.pref, now).run();
                  // line_usersも更新（フォロー管理用）
                  await env.DB.prepare(
                    'UPDATE line_users SET updated_at = ? WHERE user_id = ?'
                  ).bind(now, userId).run();
                  const count = await env.DB.prepare('SELECT COUNT(*) as cnt FROM line_user_cities WHERE user_id = ?').bind(userId).all();
                  const total = count.results?.[0]?.cnt || 1;
                  await lineReply(env, event.replyToken, [
                    registeredFlexMessage(cityMatch.pref, cityMatch.name, total),
                  ]);
                }
              } else {
                // 候補検索
                const suggestions = await findCitySuggestions(env, text);
                if (suggestions.length > 0) {
                  const sugList = suggestions.map(s => `・${s.prefecture}${s.name}`).join('\n');
                  await lineReply(env, event.replyToken, [
                    { type: 'text', text: `「${text}」に完全一致する市区町村が見つかりませんでした。\n\nもしかして:\n${sugList}\n\n正式名称で送り直してみてください。` },
                  ]);
                } else {
                  await lineReply(env, event.replyToken, [
                    { type: 'text', text: `「${text}」に該当する市区町村が見つかりませんでした。\n\n現在455市区町村に対応しています。\n正式名称（例: 「さいたま市」「世田谷区」）で送信してみてください。\n\n📖 「ヘルプ」で使い方を確認` },
                  ]);
                }
              }
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
          users = await env.DB.prepare('SELECT DISTINCT user_id FROM line_user_cities WHERE city_code = ?').bind(city_code).all();
        } else {
          users = await env.DB.prepare('SELECT DISTINCT user_id FROM line_users').all();
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

// Flex Messages
function welcomeFlexMessage() {
  return {
    type: 'flex', altText: 'ホジョタウンへようこそ！',
    contents: {
      type: 'bubble',
      header: { type: 'box', layout: 'vertical', backgroundColor: '#1a5c3a', paddingAll: '16px', contents: [
        { type: 'text', text: 'ホジョタウン', color: '#ffffff', weight: 'bold', size: 'xl' },
        { type: 'text', text: 'あなたの街の補助金、30秒で全部わかる', color: '#c8e6c9', size: 'xs', margin: 'sm' },
      ]},
      body: { type: 'box', layout: 'vertical', spacing: 'md', paddingAll: '16px', contents: [
        { type: 'text', text: '友だち追加ありがとうございます！', weight: 'bold', size: 'md' },
        { type: 'separator', margin: 'md' },
        { type: 'text', text: 'できること', weight: 'bold', size: 'sm', margin: 'md', color: '#1a5c3a' },
        { type: 'box', layout: 'vertical', spacing: 'sm', margin: 'sm', contents: [
          { type: 'text', text: '📍 市名を送信 → 補助金の更新通知を登録', size: 'sm', wrap: true },
          { type: 'text', text: '📋 「確認」→ 登録中の市を表示', size: 'sm', wrap: true },
          { type: 'text', text: '🔍 「診断」→ 30秒で補助金診断', size: 'sm', wrap: true },
          { type: 'text', text: '📖 「ヘルプ」→ 使い方を表示', size: 'sm', wrap: true },
        ]},
        { type: 'separator', margin: 'md' },
        { type: 'text', text: 'まずはお住まいの市区町村名を\n送信してみてください！', size: 'sm', wrap: true, margin: 'md', color: '#666666' },
        { type: 'text', text: '例: 名古屋市、世田谷区、札幌市', size: 'xs', color: '#999999', margin: 'sm' },
      ]},
      footer: { type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '12px', contents: [
        { type: 'button', action: { type: 'uri', label: '補助金を診断する', uri: 'https://hojotown.jp/shindan/' }, style: 'primary', color: '#1a5c3a', height: 'sm' },
        { type: 'button', action: { type: 'message', label: 'ヘルプを見る', text: 'ヘルプ' }, style: 'secondary', height: 'sm' },
      ]},
    }
  };
}

function registeredFlexMessage(pref, name, total) {
  return {
    type: 'flex', altText: `${pref}${name}を登録しました`,
    contents: {
      type: 'bubble', size: 'kilo',
      body: { type: 'box', layout: 'vertical', spacing: 'md', paddingAll: '16px', contents: [
        { type: 'text', text: '✅ 登録完了', weight: 'bold', size: 'lg', color: '#1a5c3a' },
        { type: 'text', text: `${pref}${name}`, weight: 'bold', size: 'md', margin: 'sm' },
        { type: 'text', text: `（現在${total}件登録中）`, size: 'xs', color: '#999999' },
        { type: 'separator', margin: 'md' },
        { type: 'text', text: '補助金情報に更新があればお知らせします。\n他の市も追加で登録できます。', size: 'sm', wrap: true, margin: 'md', color: '#666666' },
      ]},
      footer: { type: 'box', layout: 'horizontal', spacing: 'sm', paddingAll: '12px', contents: [
        { type: 'button', action: { type: 'message', label: '登録一覧', text: '確認' }, style: 'secondary', height: 'sm', flex: 1 },
        { type: 'button', action: { type: 'uri', label: '診断する', uri: 'https://hojotown.jp/shindan/' }, style: 'primary', color: '#1a5c3a', height: 'sm', flex: 1 },
      ]},
    }
  };
}

function helpFlexMessage() {
  return {
    type: 'flex', altText: 'ホジョタウンの使い方',
    contents: {
      type: 'bubble',
      header: { type: 'box', layout: 'vertical', backgroundColor: '#1a5c3a', paddingAll: '14px', contents: [
        { type: 'text', text: '📖 使い方ガイド', color: '#ffffff', weight: 'bold', size: 'lg' },
      ]},
      body: { type: 'box', layout: 'vertical', spacing: 'lg', paddingAll: '16px', contents: [
        { type: 'box', layout: 'vertical', spacing: 'xs', contents: [
          { type: 'text', text: '通知を受け取る', weight: 'bold', size: 'sm', color: '#1a5c3a' },
          { type: 'text', text: '市区町村名を送信するだけ！\n複数の市を登録できます。', size: 'sm', wrap: true, color: '#666666' },
          { type: 'text', text: '例: 「名古屋市」「世田谷区」', size: 'xs', color: '#999999' },
        ]},
        { type: 'separator' },
        { type: 'box', layout: 'vertical', spacing: 'xs', contents: [
          { type: 'text', text: 'コマンド一覧', weight: 'bold', size: 'sm', color: '#1a5c3a' },
          { type: 'text', text: '📋 確認 → 登録中の市一覧', size: 'sm', wrap: true },
          { type: 'text', text: '🗑️ ○○市 解除 → その市を解除', size: 'sm', wrap: true },
          { type: 'text', text: '🗑️ 解除 → 全て解除', size: 'sm', wrap: true },
          { type: 'text', text: '🔍 診断 → 補助金診断ページ', size: 'sm', wrap: true },
        ]},
      ]},
      footer: { type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '12px', contents: [
        { type: 'button', action: { type: 'uri', label: '補助金を診断する', uri: 'https://hojotown.jp/shindan/' }, style: 'primary', color: '#1a5c3a', height: 'sm' },
        { type: 'button', action: { type: 'uri', label: 'サイトを開く', uri: 'https://hojotown.jp/' }, style: 'secondary', height: 'sm' },
      ]},
    }
  };
}

function shindanResultFlexMessage(pref, cityName, count, amount) {
  return {
    type: 'flex', altText: `${pref}${cityName}の診断結果: ${count}件（最大${amount}円）`,
    contents: {
      type: 'bubble',
      header: { type: 'box', layout: 'vertical', backgroundColor: '#1a5c3a', paddingAll: '16px', contents: [
        { type: 'text', text: '🔍 補助金診断結果', color: '#ffffff', weight: 'bold', size: 'lg' },
        { type: 'text', text: 'ホジョタウン', color: '#c8e6c9', size: 'xs', margin: 'sm' },
      ]},
      body: { type: 'box', layout: 'vertical', spacing: 'md', paddingAll: '16px', contents: [
        { type: 'box', layout: 'horizontal', contents: [
          { type: 'text', text: '📍 地域', size: 'sm', color: '#999999', flex: 2 },
          { type: 'text', text: `${pref}${cityName}`, size: 'sm', weight: 'bold', flex: 5 },
        ]},
        { type: 'separator', margin: 'md' },
        { type: 'box', layout: 'horizontal', margin: 'md', contents: [
          { type: 'box', layout: 'vertical', flex: 1, contents: [
            { type: 'text', text: '該当件数', size: 'xs', color: '#999999', align: 'center' },
            { type: 'text', text: `${count}件`, size: 'xxl', weight: 'bold', color: '#1a5c3a', align: 'center' },
          ]},
          { type: 'separator' },
          { type: 'box', layout: 'vertical', flex: 1, contents: [
            { type: 'text', text: '最大合計額', size: 'xs', color: '#999999', align: 'center' },
            { type: 'text', text: `${amount}円`, size: 'lg', weight: 'bold', color: '#e65100', align: 'center' },
          ]},
        ]},
        { type: 'separator', margin: 'md' },
        { type: 'text', text: `✅ ${pref}${cityName}の補助金通知に登録しました。新しい補助金が追加されたらお知らせします。`, size: 'xs', wrap: true, margin: 'md', color: '#666666' },
      ]},
      footer: { type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '12px', contents: [
        { type: 'button', action: { type: 'uri', label: `${cityName}の補助金を見る`, uri: `https://hojotown.jp/?city=${encodeURIComponent(cityName)}` }, style: 'primary', color: '#1a5c3a', height: 'sm' },
        { type: 'button', action: { type: 'uri', label: 'もう一度診断する', uri: 'https://hojotown.jp/shindan/' }, style: 'secondary', height: 'sm' },
      ]},
    }
  };
}

// 候補検索（部分一致で最大5件）
async function findCitySuggestions(env, text) {
  const cleaned = text.replace(/[市区町村県都府]$/g, '').trim();
  if (cleaned.length < 1) return [];
  const results = await env.DB.prepare(
    "SELECT code, name, prefecture FROM cities WHERE name LIKE ? OR name LIKE ? LIMIT 5"
  ).bind('%' + cleaned + '%', cleaned + '%').all();
  return results.results || [];
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
