#!/bin/bash
# A user previews an image in Drive's viewer: the file's metadata gives its thumbnail links (GET /files/:id, their secret
# in Redis), the viewer loads the large one (GET /files/:id/thumbnails/:secret/large, from S3), an image. The image is a
# fixture whose thumbnails were made while the stack was healthy.
. "$(dirname "$0")/lib.sh"

image_fixture() { py png "$1" fixture-image; }
id="$(ensure_fixture image picture.png image_fixture image/png 2>&1)" || fail "setup: $id"
api "$CHAOS_USER" GET "/files/$id" || fail "$(why 'the image')"
large="$(jq -r '.data.links.large // empty' <<<"$BODY")"
[ -n "$large" ] || fail "the image has no thumbnail links"
# a fixture just made: its thumbnails by a job, waited for (once, the stack healthy)
while :; do
  code="$(curl -s -m "$(ct)" -o "$WORK/large" -D "$WORK/large.h" -w '%{http_code}' -H "Host: $CHAOS_INSTANCE" "$CHAOS_STACK_URL$large")"
  [ "$code" = 200 ] && break
  [ "$code" = 404 ] && [ -z "$(find "$STATE_DIR/fixture.image" -mmin +2 2>/dev/null)" ] && [ "$(remaining)" -gt 0 ] \
    || fail "the preview: HTTP $code $(head -c 200 "$WORK/large")"
  sleep 0.5
done
grep -qi '^content-type: image/' "$WORK/large.h" && [ -s "$WORK/large" ] \
  || fail "the preview is not an image: $(grep -i '^content-type' "$WORK/large.h")"
ok "the preview of an image loaded ($(elapsed))"
