#!/bin/bash
# A user uploads a photo: its thumbnails are made in the background (the "thumbnail" job, triggered by the new file:
# Redis, the image read and the thumbnails written in S3) and Drive shows them: the small thumbnail of the file
# (links.small of GET /files/:id, its secret in Redis) is served, an image.
. "$(dirname "$0")/lib.sh"

dir="$(work_dir "$CHAOS_USER" 2>&1)" || fail "$dir"
py png "$WORK/p.png" "$TOKEN_ID"
id="$(upload "$CHAOS_USER" "$dir" "photo-$TOKEN_ID.png" "$WORK/p.png" image/png 2>&1)" || fail "setup: $id"
cleanup_file "$CHAOS_USER" "$id"
api "$CHAOS_USER" GET "/files/$id" || fail "$(why 'the photo')"
small="$(jq -r '.data.links.small // empty' <<<"$BODY")"
[ -n "$small" ] || fail "the photo has no thumbnail links"
# the link is given at once, the thumbnail served once the job has made it (404 before)
while :; do
  code="$(curl -s -m "$(ct)" -o "$WORK/small" -D "$WORK/small.h" -w '%{http_code}' -H "Host: $CHAOS_INSTANCE" "$CHAOS_STACK_URL$small")"
  [ "$code" = 200 ] && break
  [ "$code" = 404 ] || fail "the thumbnail: HTTP $code $(head -c 200 "$WORK/small")"
  [ "$(remaining)" -gt 0 ] || fail "no thumbnail made after ${BUDGET}s"
  sleep 0.5
done
grep -qi '^content-type: image/' "$WORK/small.h" || fail "the thumbnail is not an image: $(grep -i '^content-type' "$WORK/small.h")"
ok "the thumbnail of a new photo made ($(elapsed))"
