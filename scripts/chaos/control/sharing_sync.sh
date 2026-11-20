#!/bin/bash
# A user works in a folder synchronized with a colleague (a Cozy to Cozy sharing in sync mode, alice -> bob): a folder
# created in it by alice appears in bob's own Drive (the sharing replication: the "share-replicate" job, Redis, alice's
# instance writing into bob's). Metadata only. The sharing itself is a fixture, made once and kept between runs: a
# contact of bob with his instance, POST /sharings/ (the invitation lands in bob's "Shared with me" as a shortcut), bob
# accepts it signed in on his instance (the authorize page, POST /auth/authorize/sharing).
. "$(dirname "$0")/lib.sh"

fixture="$STATE_DIR/fixture.sharing"
# sharing_ready <sid>: the sharing active and bob a ready member, on alice's side
sharing_ready() {
  api "$CHAOS_USER" GET "/sharings/$1" || return 1
  jq -e --arg e "$CHAOS_EMAIL2" '.data.attributes.active == true and any(.data.attributes.members[]; .email == $e and .status == "ready")' \
    <<<"$BODY" >/dev/null
}

contact_of_bob() {  # the id of the contact of bob in alice's contacts, with the URL of his instance (made once)
  local file="$STATE_DIR/contact.$CHAOS_USER2"
  if [ -s "$file" ]; then cat "$file"; return 0; fi
  api "$CHAOS_USER" POST /data/io.cozy.contacts/ -H 'Content-Type: application/json' --data-binary "$(jq -nc --arg e "$CHAOS_EMAIL2" \
    --arg u "$(instance_url "$CHAOS_USER2")" --arg n "$CHAOS_USER2" '{fullname:$n, email:[{address:$e, primary:true}], cozy:[{url:$u, primary:true}]}')" \
    || { why "the contact of $CHAOS_USER2" >&2; return 1; }
  jq -r '.id // .data.id' <<<"$BODY" >"$file.$$" && mv -f "$file.$$" "$file"
  cat "$file"
}

# bob_accepts <sid>: bob finds the invitation in his Shared with me (its shortcut holds the state) and accepts it
bob_accepts() {
  local sid="$1" state="" cookie page csrf ccookie code host="$CHAOS_INSTANCE2" ids id try
  while [ -z "$state" ]; do
    api "$CHAOS_USER2" GET "/files/io.cozy.files.shared-with-me-dir?page%5Blimit%5D=100" || { why "$CHAOS_USER2's Shared with me" >&2; return 1; }
    mapfile -t ids < <(jq -r '.included[]? | select(.attributes.class == "shortcut" or (.attributes.name | endswith(".url"))) | .id' <<<"$BODY")
    for id in "${ids[@]}"; do
      api "$CHAOS_USER2" GET "/shortcuts/$id" || continue
      state="$(jq -r --arg s "/sharings/$sid/discovery" '.data.attributes.url | select(contains($s)) | capture("state=(?<s>[^&]+)").s' <<<"$BODY" 2>/dev/null)"
      [ -n "$state" ] && break
    done
    [ -n "$state" ] && break
    [ "$(remaining)" -gt 0 ] || { echo "no invitation in $CHAOS_USER2's Shared with me" >&2; return 1; }
    sleep 1
  done
  for try in 1 2; do
    cookie="$(session "$CHAOS_USER2")" || return 1
    page="$(curl -s -m "$(ct)" -D "$WORK/az.h" -H "Host: $host" -H "Cookie: $cookie" \
      "$CHAOS_STACK_URL/auth/authorize/sharing?sharing_id=$sid&state=$state")"
    # the session held has ended (a 303 to the login page): signed in again
    grep -qi '^location: [^ ]*/auth/login' "$WORK/az.h" && [ $try = 1 ] && { forget_session "$CHAOS_USER2"; continue; }
    break
  done
  csrf="$(sed -n 's/.*name="csrf_token" value="\([^"]*\)".*/\1/p' <<<"$page" | head -1)"
  ccookie="$(sed -n 's/^[Ss]et-[Cc]ookie: \(_csrf=[^;]*\).*/\1/p' "$WORK/az.h" | head -1)"
  [ -n "$csrf" ] && [ -n "$ccookie" ] || { echo "the authorize page of the sharing has no form: $(head -c 200 <<<"$page")" >&2; return 1; }
  code="$(curl -s -m "$(ct)" -o "$WORK/az.b" -w '%{http_code}' -H "Host: $host" -H "Cookie: $cookie; $ccookie" \
    --data-urlencode "csrf_token=$csrf" --data-urlencode "sharing_id=$sid" --data-urlencode "state=$state" \
    "$CHAOS_STACK_URL/auth/authorize/sharing")"
  [ "$code" = 303 ] || { echo "the acceptance of the sharing: HTTP $code $(head -c 200 "$WORK/az.b")" >&2; return 1; }
}

make_sharing() {
  local dir d contact sid
  dir="$(work_dir "$CHAOS_USER")" || return 1
  d="$(make_dir "$CHAOS_USER" "$dir" "synced-with-$CHAOS_USER2-$TOKEN_ID")" || return 1
  contact="$(contact_of_bob)" || return 1
  api "$CHAOS_USER" POST /sharings/ -H 'Content-Type: application/vnd.api+json' --data-binary "$(jq -nc --arg d "$d" --arg c "$contact" --arg t "chaos sync $TOKEN_ID" '
    {data:{type:"io.cozy.sharings", attributes:{description:$t, rules:[{title:$t, doctype:"io.cozy.files", values:[$d], add:"sync", update:"sync", remove:"sync"}]},
           relationships:{recipients:{data:[{type:"io.cozy.contacts", id:$c}]}}}}')" || { why "the sharing with $CHAOS_USER2" >&2; return 1; }
  sid="$(jq -r '.data.id' <<<"$BODY")"
  bob_accepts "$sid" || return 1
  until sharing_ready "$sid"; do
    [ "$(remaining)" -gt 0 ] || { echo "the sharing is not ready: $(jq -c '[.data.attributes.members[] | .status]' <<<"$BODY" 2>/dev/null)" >&2; return 1; }
    sleep 1
  done
  printf '%s %s\n' "$sid" "$d" >"$fixture"
}

if [ -s "$fixture" ]; then
  read -r sid shared <"$fixture"
  if ! sharing_ready "$sid"; then
    [ "${CODE:0:1}" = 2 ] || [ "$CODE" = 404 ] || fail "$(why 'the sharing with bob')"
    rm -f "$fixture"
  fi
fi
if [ ! -s "$fixture" ]; then
  err="$(make_sharing 2>&1)" || fail "setup: $err"
fi
read -r sid shared <"$fixture"

name="sync-$TOKEN_ID"
id="$(make_dir "$CHAOS_USER" "$shared" "$name" 2>&1)" || fail "$id"
cleanup_file "$CHAOS_USER" "$id"
api "$CHAOS_USER2" POST /data/io.cozy.files/_index -H 'Content-Type: application/json' \
  --data-binary '{"index":{"fields":["name"]},"ddoc":"chaos-by-name"}' || fail "$(why "$CHAOS_USER2's index")"
while :; do
  api "$CHAOS_USER2" POST /files/_find -H 'Content-Type: application/json' \
    --data-binary "$(jq -nc --arg n "$name" '{selector:{name:$n}, use_index:"_design/chaos-by-name", limit:1}')" \
    || fail "$(why "$CHAOS_USER2's files")"
  [ "$(jq -r '.data | length' <<<"$BODY")" -gt 0 ] && break
  [ "$(remaining)" -gt 0 ] || fail "the folder created by $CHAOS_USER is not in $CHAOS_USER2's Drive after ${BUDGET}s"
  sleep 0.5
done
ok "a folder created in the synchronized folder appeared in $CHAOS_USER2's Drive ($(elapsed))"
