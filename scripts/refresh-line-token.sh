#!/bin/bash
# LINE Channel Access Token を更新して Cloudflare Worker secret に設定
# 月2回ローカルで実行するか、GitHub Actions (line-token-refresh.yml) で自動実行

CHANNEL_ID="REDACTED_LINE_CHANNEL_ID"
CHANNEL_SECRET="REDACTED_LINE_CHANNEL_SECRET"

echo "=== LINE Token Refresh ==="

# 新しいトークン発行
RESPONSE=$(curl -s -X POST "https://api.line.me/v2/oauth/accessToken" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id=${CHANNEL_ID}&client_secret=${CHANNEL_SECRET}")

TOKEN=$(echo "$RESPONSE" | python3 -c "import json,sys; print(json.load(sys.stdin).get('access_token',''))" 2>/dev/null)

if [ -z "$TOKEN" ]; then
  echo "❌ トークン発行失敗: $RESPONSE"
  exit 1
fi

echo "✅ 新しいトークン取得成功"

# Worker secret更新
cd "$(dirname "$0")/../worker"
echo "$TOKEN" | npx wrangler secret put LINE_CHANNEL_TOKEN 2>&1

# 動作確認
BOT_NAME=$(curl -s "https://api.line.me/v2/bot/info" -H "Authorization: Bearer ${TOKEN}" | python3 -c "import json,sys; print(json.load(sys.stdin).get('displayName','?'))" 2>/dev/null)
echo "✅ Bot確認: $BOT_NAME"
echo "✅ 更新完了（有効期限: 30日）"
