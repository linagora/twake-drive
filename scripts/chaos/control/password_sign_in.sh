#!/bin/bash
# A user signs in on the login page of the instance with their password (the passphrase hashed by the page, PBKDF2):
# a session cookie, that the instance recognizes (GET /auth/login with it redirects to the default app, a signed-in
# user's answer, instead of the form).
. "$(dirname "$0")/lib.sh"

cookie="$(web_login "$CHAOS_USER" 2>&1)" || fail "$cookie"
code="$(curl -s -m "$(ct)" -o "$WORK/s" -D "$WORK/s.h" -w '%{http_code}' -H "Host: $CHAOS_INSTANCE" -H "Cookie: $cookie" \
  "$CHAOS_STACK_URL/auth/login")"
[ "$code" = 303 ] || fail "the new session is not recognized: HTTP $code $(head -c 200 "$WORK/s")"
grep -qi '^location: .*drive' "$WORK/s.h" || fail "the signed-in user is not sent to Drive: $(grep -i '^location' "$WORK/s.h")"
# a session as good as the held one: kept
printf '%s' "$cookie" >"$STATE_DIR/session.$CHAOS_USER.$$" && mv -f "$STATE_DIR/session.$CHAOS_USER.$$" "$STATE_DIR/session.$CHAOS_USER"
ok "signed in with the password, a session ($(elapsed))"
