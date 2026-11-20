#!/bin/bash
# A signed-in user opens Drive in the browser: its index.html served by the instance (alice-drive.<domain>, the app's
# files in S3), with the token of the session injected, and the scripts it references (the bundle of the commit).
. "$(dirname "$0")/lib.sh"

app_host="${CHAOS_USER}-drive.$CHAOS_DOMAIN"
get_index() {
  curl -s -m "$(ct)" -o "$WORK/index.html" -w '%{http_code}' -H "Host: $app_host" -H "Cookie: $1" "$CHAOS_STACK_URL/"
}
cookie="$(session "$CHAOS_USER" 2>&1)" || fail "no session: $cookie"
code="$(get_index "$cookie")"
if [ "$code" = 302 ]; then  # the session held has ended: signed in again
  forget_session "$CHAOS_USER"
  cookie="$(session "$CHAOS_USER" 2>&1)" || fail "no session: $cookie"
  code="$(get_index "$cookie")"
fi
[ "$code" = 200 ] || fail "the index of Drive: HTTP $code $(head -c 200 "$WORK/index.html")"
# data-cozy: the JSON of {{.CozyData}}, HTML-escaped; its token the app's for the session
grep -q 'data-cozy="{' "$WORK/index.html" || fail "the index of Drive has no cozy data: $(head -c 200 "$WORK/index.html")"
grep -q '&#34;token&#34;:&#34;[A-Za-z0-9_-]' "$WORK/index.html" || fail "the index of Drive has no token for the session"
mapfile -t scripts < <(grep -o '<script[^>]*src="[^"]*"' "$WORK/index.html" | sed -n 's/.*src="\([^"]*\)".*/\1/p' | grep -v '^//\|^http' | head -3)
[ ${#scripts[@]} -gt 0 ] || fail "the index of Drive references no script of its own"
for s in "${scripts[@]}"; do
  s="/${s#/}"
  code="$(curl -s -m "$(ct)" -o "$WORK/asset" -w '%{http_code}' -H "Host: $app_host" -H "Cookie: $cookie" "$CHAOS_STACK_URL$s")"
  [ "$code" = 200 ] && [ -s "$WORK/asset" ] || fail "the script $s of Drive: HTTP $code"
done
ok "Drive's index and its ${#scripts[@]} scripts served ($(elapsed))"
