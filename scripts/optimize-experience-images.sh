#!/usr/bin/env bash
# Optimise the Ischia experience images for thumbnail display.
# Cover-crops each to 720x480 (plenty for the ~360x220 card display at 2x) and
# re-encodes, dramatically reducing file size. Large photo PNGs are converted
# to JPEG. webp inputs are left untouched (already small / sips write support
# is unreliable). Operates via a temp file then moves into place.

TARGET_W=720
TARGET_H=480
DIR="images/experiences"

cover_resize() {
  # $1 = source path, $2 = output path, $3 = output format (jpeg|png)
  local src="$1" out="$2" fmt="$3"
  local w h nw nh tmp
  w=$(sips -g pixelWidth "$src"  | awk '/pixelWidth/{print $2}')
  h=$(sips -g pixelHeight "$src" | awk '/pixelHeight/{print $2}')
  read -r nw nh < <(awk -v w="$w" -v h="$h" -v tw="$TARGET_W" -v th="$TARGET_H" \
    'BEGIN{ s1=tw/w; s2=th/h; s=(s1>s2)?s1:s2; printf "%d %d", int(w*s)+1, int(h*s)+1 }')
  tmp="$(mktemp -t expimg).${fmt}"
  sips -s format "$fmt" -z "$nh" "$nw" "$src" --out "$tmp" >/dev/null 2>&1
  sips -c "$TARGET_H" "$TARGET_W" "$tmp" >/dev/null 2>&1
  mv "$tmp" "$out"
  echo "  $out ($(du -h "$out" | awk '{print $1}'))"
}

echo "Resizing JPEGs in place..."
for f in 1-picnic.jpg 3-dinner-park.jpg 4-boat-tour.jpg 5-capri.jpg 7-wine-tasting.jpeg 9-dinner-fluctus.jpg; do
  [ -f "$DIR/$f" ] && cover_resize "$DIR/$f" "$DIR/$f" jpeg
done

echo "Converting large PNGs to JPEG..."
for base in 2-cooking 8-dinner-umberto; do
  if [ -f "$DIR/$base.png" ]; then
    cover_resize "$DIR/$base.png" "$DIR/$base.jpg" jpeg
    rm -f "$DIR/$base.png"
    echo "  removed $DIR/$base.png"
  fi
done

echo "Leaving 6-spa.webp untouched (already small)."
echo "Done. New total:"
du -sh "$DIR"
