#!/bin/bash
# An administrator lists the instances of the stack and reads one (the admin API, basic auth: GET /instances,
# GET /instances/:domain, from the global database of CouchDB). Creating an instance is not probed: each one adds
# tens of CouchDB databases, a run of chaos would pile them up.
. "$(dirname "$0")/lib.sh"

admin() { curl -s -m "$(ct)" -o "$WORK/a" -w '%{http_code}' -u "admin:$CHAOS_ADMIN_PASSPHRASE" -H 'Accept: application/vnd.api+json' "$CHAOS_ADMIN_URL$1"; }
code="$(admin /instances)"
[ "$code" = 200 ] || fail "the list of the instances: HTTP $code $(head -c 200 "$WORK/a")"
jq -e --arg a "$CHAOS_INSTANCE" --arg b "$CHAOS_INSTANCE2" '[.data[].attributes.domain] | index($a) != null and index($b) != null' "$WORK/a" >/dev/null \
  || fail "the list of the instances lacks $CHAOS_INSTANCE or $CHAOS_INSTANCE2"
code="$(admin "/instances/$CHAOS_INSTANCE")"
[ "$code" = 200 ] || fail "the instance $CHAOS_INSTANCE: HTTP $code $(head -c 200 "$WORK/a")"
jq -e --arg a "$CHAOS_INSTANCE" '.data.attributes.domain == $a' "$WORK/a" >/dev/null || fail "another instance answered"
ok "the instances listed and one read by the admin API ($(elapsed))"
