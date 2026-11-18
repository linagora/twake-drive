#!/bin/bash
# A user downloads several files at once: Drive asks for an archive (POST /files/archive, its secret in Redis) and
# fetches the zip (GET /files/archive/:secret/:name, made on the fly from the contents in S3); the zip holds the files.
. "$(dirname "$0")/lib.sh"

text_fixture() { printf 'chaos fixture text\n' >"$1"; }
image_fixture() { py png "$1" fixture-image; }
t="$(ensure_fixture text note.txt text_fixture text/plain 2>&1)" || fail "setup: $t"
i="$(ensure_fixture image picture.png image_fixture image/png 2>&1)" || fail "setup: $i"
api "$CHAOS_USER" POST /files/archive -H 'Content-Type: application/vnd.api+json' --data-binary \
  "$(jq -nc --arg t "$t" --arg i "$i" --arg n "archive-$TOKEN_ID" '{data:{type:"io.cozy.files.archives", attributes:{name:$n, ids:[$t, $i]}}}')" \
  || fail "$(why 'the archive')"
link="$(jq -r '.links.related // empty' <<<"$BODY")"
[ -n "$link" ] || fail "no archive link in $(head -c 200 <<<"$BODY")"
code="$(curl -s -m "$(ct)" -o "$WORK/a.zip" -w '%{http_code}' -H "Host: $CHAOS_INSTANCE" "$CHAOS_STACK_URL$link")"
[ "$code" = 200 ] || fail "the archive: HTTP $code $(head -c 200 "$WORK/a.zip")"
n="$(python3 -I -c 'import sys, zipfile; z = zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; print(len([e for e in z.namelist() if not e.endswith("/")]))' "$WORK/a.zip" 2>/dev/null)" \
  || fail "the archive is not a valid zip ($(stat -c %s "$WORK/a.zip") bytes)"
[ "$n" = 2 ] || fail "the archive holds $n files, not 2"
ok "an archive of 2 files made and downloaded ($(elapsed))"
