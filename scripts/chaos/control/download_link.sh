#!/bin/bash
# A user downloads a file from Drive's download button: a download link made for it (POST /files/downloads?Id=, its
# secret in Redis), then fetched without authentication (GET /files/downloads/:secret/:name, the content in S3).
. "$(dirname "$0")/lib.sh"

text_fixture() { printf 'chaos fixture text\n' >"$1"; }
id="$(ensure_fixture text note.txt text_fixture text/plain 2>&1)" || fail "setup: $id"
api "$CHAOS_USER" POST "/files/downloads?Id=$id" || fail "$(why 'the download link')"
link="$(jq -r '.links.related // empty' <<<"$BODY")"
[ -n "$link" ] || fail "no download link in $(head -c 200 <<<"$BODY")"
code="$(curl -s -m "$(ct)" -o "$WORK/dl" -w '%{http_code}' -H "Host: $CHAOS_INSTANCE" "$CHAOS_STACK_URL$link")"
[ "$code" = 200 ] || fail "the download link: HTTP $code $(head -c 200 "$WORK/dl")"
[ "$(cat "$WORK/dl")" = "chaos fixture text" ] || fail "the download link gives another content"
ok "a download link made and fetched ($(elapsed))"
