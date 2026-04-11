#!/bin/bash
# LINE Channel Access Token を更新して Cloudflare Worker secret に設定
# 月2回ローカルで実行するか、GitHub Actions (line-token-refresh.yml) で自動実行
# 必要な環境変数: LINE_CHANNEL_ID, LINE_CHANNEL_SECRET (bot/.envから読み込み)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../bot/.env"

if [ -f "$ENV_FILE" ]; then
  export $(grep -v '^#' "$ENV_FILE" | xargs)
fi

CHANNEL_ID="${LINE_CHANNEL_ID:-}"
CHANNEL_SECRET="${LINE_CHANNEL_SECRET:-}"

if [ -z "$CHANNEL_ID" ] || [ -z "$CHANNEL_SECRET" ]; then
  echo "❌ LINE_CHANNEL_ID / LINE_CHANNEL_SECRET が未設定"
  echo "   bot/.env に設定するか環境変数で渡してください"
  exit 1
fi

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
cd "$SCRIPT_DIR/../worker"
echo "$TOKEN" | npx wrangler secret put LINE_CHANNEL_TOKEN 2>&1

# 動作確認
BOT_NAME=$(curl -s "https://api.line.me/v2/bot/info" -H "Authorization: Bearer ${TOKEN}" | python3 -c "import json,sys; print(json.load(sys.stdin).get('displayName','?'))" 2>/dev/null)
echo "✅ Bot確認: $BOT_NAME"
echo "✅ 更新完了（有効期限: 30日）"
