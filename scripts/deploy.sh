#!/bin/bash
set -e

echo "=== [0/5] 記事整合性チェック ==="
node scripts/check-articles.cjs
if [ $? -ne 0 ]; then
  echo "❌ 記事チェック失敗。デプロイ中止。"
  exit 1
fi
echo "✅ 記事チェック通過"

echo ""
echo "=== [1/5] ビルド ==="
npm run build

echo ""
echo "=== [2/5] コンテンツチェック ==="
ERRORS=0

# 空タイトルチェック
EMPTY_TITLES=$(grep -rl '<title> |' dist/ 2>/dev/null | grep -v _astro || true)
if [ -n "$EMPTY_TITLES" ]; then
  echo "❌ 空タイトル検出:"
  echo "$EMPTY_TITLES"
  ERRORS=$((ERRORS+1))
fi

# ダミー文言チェック
DUMMY=$(grep -rl 'サンプル\|ダミー\|TODO\|FIXME\|運営者（個人運営）\|undefined' dist/ 2>/dev/null | grep -v _astro || true)
if [ -n "$DUMMY" ]; then
  echo "❌ ダミー文言検出:"
  echo "$DUMMY"
  ERRORS=$((ERRORS+1))
fi

# 実名チェック
REALNAME=$(grep -rl '山内.*魁也' dist/ 2>/dev/null | grep -v _astro || true)
if [ -n "$REALNAME" ]; then
  echo "❌ 実名が公開ページに含まれています:"
  echo "$REALNAME"
  ERRORS=$((ERRORS+1))
fi

# 全HTMLがDOCTYPEで始まるか
BAD_HTML=""
while IFS= read -r f; do
  if ! head -c 15 "$f" | grep -q '<!DOCTYPE html>'; then
    BAD_HTML="$BAD_HTML\n$f"
  fi
done < <(find dist -name "index.html")
if [ -n "$BAD_HTML" ]; then
  echo "❌ DOCTYPE missing:"
  echo -e "$BAD_HTML"
  ERRORS=$((ERRORS+1))
fi

if [ $ERRORS -gt 0 ]; then
  echo ""
  echo "❌ コンテンツチェック失敗（$ERRORS件）。デプロイ中止。"
  exit 1
fi
echo "✅ コンテンツチェック通過"

echo ""
echo "=== [3/5] デプロイ ==="
npx wrangler pages deploy dist --project-name=hojotown --commit-dirty=true

echo ""
echo "=== [4/5] 本番確認 ==="
sleep 5

PAGES=("/" "/about/" "/shindan/" "/compare/" "/saitama/kawagoe/" "/hokkaido/sapporo/" "/osaka/osaka/" "/privacy/" "/contact/")
FAIL=0
for page in "${PAGES[@]}"; do
  STATUS=$(curl -sI "https://hojotown.jp${page}" 2>/dev/null | grep "HTTP/" | awk '{print $2}')
  if [ "$STATUS" = "200" ]; then
    echo "✅ ${page} → ${STATUS}"
  else
    echo "❌ ${page} → ${STATUS:-TIMEOUT}"
    FAIL=$((FAIL+1))
  fi
done

if [ $FAIL -gt 0 ]; then
  echo ""
  echo "⚠️ ${FAIL}件のページが200以外。確認してください。"
  exit 1
fi

echo ""
echo "🎉 デプロイ完了。全ページ正常。"

# Discord通知
DEPLOY_WEBHOOK="REDACTED_DISCORD_DEPLOY_WEBHOOK"
PAGES=$(find dist -name "index.html" | wc -l)
curl -s -X POST "$DEPLOY_WEBHOOK" \
  -H "Content-Type: application/json" \
  -d "{\"embeds\":[{\"title\":\"デプロイ完了\",\"description\":\"${PAGES}ページ正常にデプロイされました\",\"color\":3066993,\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}]}" > /dev/null 2>&1
