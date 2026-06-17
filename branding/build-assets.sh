#!/usr/bin/env sh
# branding/ の SVG ソースから public/ の配信アセット（favicon / OGP / アプリアイコン）を再生成する。
# SVG が唯一のソース。public/ の PNG・ICO は生成物なので手編集しない。
# 必要ツール: rsvg-convert（librsvg）, magick（ImageMagick）
#   macOS: brew install librsvg imagemagick
set -e
cd "$(dirname "$0")/.."

# OGP / Twitter カード（1200x630）
rsvg-convert -w 1200 -h 630 branding/og.svg   -o public/og.png

# アプリアイコン（フルブリード正方形。iOS / Android がマスクを付ける）
rsvg-convert -w 180 -h 180 branding/icon.svg -o public/apple-touch-icon.png
rsvg-convert -w 192 -h 192 branding/icon.svg -o public/icon-192.png
rsvg-convert -w 512 -h 512 branding/icon.svg -o public/icon-512.png

# レガシー favicon.ico（16/32/48 マルチサイズ。角丸版 public/favicon.svg から）
tmp="$(mktemp -d)"
rsvg-convert -w 48 -h 48 public/favicon.svg -o "$tmp/48.png"
rsvg-convert -w 32 -h 32 public/favicon.svg -o "$tmp/32.png"
rsvg-convert -w 16 -h 16 public/favicon.svg -o "$tmp/16.png"
magick "$tmp/48.png" "$tmp/32.png" "$tmp/16.png" public/favicon.ico
rm -rf "$tmp"

echo "regenerated: public/{og.png, apple-touch-icon.png, icon-192.png, icon-512.png, favicon.ico}"
