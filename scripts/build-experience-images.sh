#!/usr/bin/env bash
# One-off helper: generate uniformly-sized (600x400, center cropped to "cover")
# placeholder experience thumbnails into images/experiences/ as gift-N.png.
# These are placeholders intended to be swapped out later — just drop a
# replacement gift-N.png into images/experiences/ keeping the same name.

TARGET_W=600
TARGET_H=400
OUT_DIR="images/experiences"

mkdir -p "$OUT_DIR"

# Source images (existing repo assets) mapped to gift-1..gift-9.
sources=(
  "images/new-forest-ponies.jpg"
  "images/crown-hotel.jpg"
  "images/map-static.jpg"
  "images/minstead-fallback.jpg"
  "images/invite-bg.jpg"
  "images/photo-carousel/01.jpg"
  "images/photo-carousel/05.jpg"
  "images/photo-carousel/10.jpg"
  "images/photo-carousel/15.jpg"
)

i=1
for src in "${sources[@]}"; do
  out="$OUT_DIR/gift-$i.png"
  w=$(sips -g pixelWidth "$src" | awk '/pixelWidth/{print $2}')
  h=$(sips -g pixelHeight "$src" | awk '/pixelHeight/{print $2}')
  # Scale so the image covers the target box (both dims >= target), then crop.
  read -r nw nh < <(awk -v w="$w" -v h="$h" -v tw="$TARGET_W" -v th="$TARGET_H" \
    'BEGIN{ s1=tw/w; s2=th/h; s=(s1>s2)?s1:s2; printf "%d %d", int(w*s)+1, int(h*s)+1 }')
  sips -s format png -z "$nh" "$nw" "$src" --out "$out" >/dev/null 2>&1
  sips -c "$TARGET_H" "$TARGET_W" "$out" >/dev/null 2>&1
  echo "wrote $out from $src (${nw}x${nh} -> ${TARGET_W}x${TARGET_H})"
  i=$((i+1))
done
