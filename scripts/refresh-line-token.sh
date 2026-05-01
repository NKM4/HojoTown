#!/bin/bash
# LINE Channel Access Token を更新して Cloudflare Worker secret に設定
# 月2回ローカルで実行するか、GitHub Actions (line-token-refresh.yml) で自動実行
# 必要な環境変数: LINE_CHANNEL_ID, LINE_CHANNEL_SECRET (bot/.envから読み込み)
set -euo pipefail

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

TOKEN=$(echo "$RESPONSE" | node -e "let b='';process.stdin.on('data',d=>b+=d);process.stdin.on('end',()=>{try{process.stdout.write(JSON.parse(b).access_token||'')}catch{}})")

if [ -z "$TOKEN" ]; then
  echo "❌ トークン発行失敗: $RESPONSE"
  exit 1
fi

echo "✅ 新しいトークン取得成功"

# 新トークン単体の動作確認
BOT_NAME=$(curl -s "https://api.line.me/v2/bot/info" -H "Authorization: Bearer ${TOKEN}" | node -e "let b='';process.stdin.on('data',d=>b+=d);process.stdin.on('end',()=>{try{process.stdout.write(JSON.parse(b).displayName||'')}catch{}})")
if [ -z "$BOT_NAME" ]; then
  echo "❌ 新トークンの検証失敗"
  exit 1
fi
echo "✅ Bot確認: $BOT_NAME"

# Worker secret更新
cd "$SCRIPT_DIR/../worker"
echo "$TOKEN" | npx wrangler secret put LINE_CHANNEL_TOKEN 2>&1

# Worker反映確認
HEALTH_STATUS=$(curl -s -o /tmp/hojotown-line-health.json -w "%{http_code}" "https://hojotown-api.taitatu4barisuta.workers.dev/health")
cat /tmp/hojotown-line-health.json
echo
if [ "$HEALTH_STATUS" != "200" ]; then
  echo "❌ Worker health failed after token refresh: HTTP $HEALTH_STATUS"
  exit 1
fi

echo "✅ 更新完了（有効期限: 30日）"
