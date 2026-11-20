#!/bin/bash
# A user signs in through the SSO: a new LemonLDAP token (password grant, the password checked in LDAP), exchanged on
# POST /oidc/access_token of the instance (cozy-stack checks it at the SSO's userinfo), and the new token lists the root.
. "$(dirname "$0")/lib.sh"

sso="$(sso_token "$CHAOS_USER" 2>&1)" || fail "SSO: $sso"
tok="$(instance_token "$CHAOS_USER" "$sso" 2>&1)" || fail "$tok"
code="$(curl -s -m "$(ct)" -o "$WORK/root" -w '%{http_code}' -H "Host: $CHAOS_INSTANCE" -H "Authorization: Bearer $tok" \
  "$CHAOS_STACK_URL/files/io.cozy.files.root-dir")"
[ "$code" = 200 ] || fail "the new token does not list the root: HTTP $code $(head -c 200 "$WORK/root")"
jq -e '.data.id == "io.cozy.files.root-dir"' "$WORK/root" >/dev/null || fail "the root folder answered is not the root"
# the new token is as good as the held one: kept
printf '%s' "$tok" >"$STATE_DIR/token.$CHAOS_USER.$$" && mv -f "$STATE_DIR/token.$CHAOS_USER.$$" "$STATE_DIR/token.$CHAOS_USER"
ok "signed in through the SSO, the root listed ($(elapsed))"
