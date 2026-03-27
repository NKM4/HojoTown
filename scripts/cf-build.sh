#!/bin/bash
# Cloudflare Pages用ダミービルドスクリプト
# 実際のデプロイはローカルからwranglerで行う
# このスクリプトはCF Pagesのビルドコマンドに設定して
# GitHub pushでの自動ビルドを無害化する
echo "Build skipped. Deploy via wrangler from local."
mkdir -p dist
echo '<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=https://hojotown.jp/"></head><body>Redirecting...</body></html>' > dist/index.html
