#!/bin/bash
#
# Does Twake Drive answer? A sign-in of $CHAOS_USER through the SSO (password grant on LemonLDAP, the token exchanged
# on POST /oidc/access_token of the instance), then a file written (CouchDB, the VFS lock in Redis, S3), read back and
# the root folder listed. Reads $CHAOS_RUN/env (start.sh). Prints the step that fails and exits 1; each request has a
# timeout of $PROBE_TIMEOUT seconds (default 15).
#
set -uo pipefail
. "$(dirname "$0")/common.sh"
. "$CHAOS_RUN/env"
t="${PROBE_TIMEOUT:-15}"
host=(-H "Host: $CHAOS_INSTANCE")
fail() { echo "probe: $*" >&2; exit 1; }

sso_token="$(curl -s -m "$t" -H "Host: $CHAOS_SSO_HOST" -u "$CHAOS_OIDC_CLIENT:$CHAOS_OIDC_SECRET" \
  -d grant_type=password -d "username=$CHAOS_USER" -d "password=$CHAOS_PASSWORD" -d 'scope=openid email profile' \
  "$CHAOS_SSO_URL/oauth2/token" | sed -n 's/.*"access_token" *: *"\([^"]*\)".*/\1/p')"
[ -n "$sso_token" ] || fail "no token from the SSO"
token="$(curl -s -m "$t" "${host[@]}" -H 'Content-Type: application/json' -H 'Accept: application/json' \
  -d "{\"client_id\":\"$CHAOS_CLIENT_ID\",\"client_secret\":\"$CHAOS_CLIENT_SECRET\",\"scope\":\"io.cozy.files\",\"oidc_token\":\"$sso_token\"}" \
  "$CHAOS_STACK_URL/oidc/access_token" | sed -n 's/.*"access_token" *: *"\([^"]*\)".*/\1/p')"
[ -n "$token" ] || fail "the instance does not exchange the SSO token"
auth=(-H "Authorization: Bearer $token")

content="probe $(date +%s%N)"
created="$(curl -s -m "$t" -w '\n%{http_code}' "${host[@]}" "${auth[@]}" -H 'Content-Type: text/plain' --data-binary "$content" \
  "$CHAOS_STACK_URL/files/io.cozy.files.root-dir?Type=file&Name=probe-$(date +%s%N).txt")"
[ "$(echo "$created" | tail -1)" = 201 ] || fail "upload: $(echo "$created" | tail -1) $(echo "$created" | head -1 | cut -c1-300)"
file_id="$(echo "$created" | head -1 | jq -r '.data.id // empty' 2>/dev/null)"
[ -n "$file_id" ] || fail "upload: no id in $(echo "$created" | head -1 | cut -c1-300)"
[ "$(curl -s -m "$t" "${host[@]}" "${auth[@]}" "$CHAOS_STACK_URL/files/download/$file_id")" = "$content" ] \
  || fail "the file uploaded does not read back"
curl -sf -m "$t" -o /dev/null "${host[@]}" "${auth[@]}" "$CHAOS_STACK_URL/files/io.cozy.files.root-dir" \
  || fail "cannot list the root folder"
echo "probe: ok"
