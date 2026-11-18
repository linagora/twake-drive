#!/bin/bash
# Two colleagues work in a shared drive (alice's, bob a member: src/modules/shareddrives): alice creates a folder in it,
# bob sees it from his own instance (GET /sharings/drives/:id/:dir-id on bob's, his instance asking alice's); bob creates
# a folder in it the same way (POST /sharings/drives/:id/:dir-id), alice sees it in her Drive. Metadata only.
# The shared drive itself is a fixture, made once and kept between runs: a contact of bob with his instance, POST
# /sharings/drives, auto-accepted by bob's instance (trusted domain: the "auto-accept" job).
. "$(dirname "$0")/lib.sh"

fixture="$STATE_DIR/fixture.shared-drive"
# drive_ready <sid>: the drive active and bob a ready member, on alice's side
drive_ready() {
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
  jq -r '.id // .data.id' <<<"$BODY" >"$file"
  cat "$file"
}

make_drive() {
  local contact sid
  contact="$(contact_of_bob)" || return 1
  api "$CHAOS_USER" POST /sharings/drives -H 'Content-Type: application/vnd.api+json' --data-binary "$(jq -nc --arg n "chaos-drive-$TOKEN_ID" --arg c "$contact" '
    {data:{type:"io.cozy.sharings", attributes:{name:$n}, relationships:{recipients:{data:[{type:"io.cozy.contacts", id:$c}]}}}}')" \
    || { why "the shared drive" >&2; return 1; }
  sid="$(jq -r '.data.id' <<<"$BODY")"
  root="$(jq -r '.data.attributes.rules[0].values[0]' <<<"$BODY")"
  until drive_ready "$sid"; do
    [ "$(remaining)" -gt 0 ] || { echo "the shared drive is not accepted by $CHAOS_USER2's instance: $(jq -c '[.data.attributes.members[] | .status]' <<<"$BODY" 2>/dev/null)" >&2; return 1; }
    sleep 1
  done
  printf '%s %s\n' "$sid" "$root" >"$fixture"
}

if [ -s "$fixture" ]; then
  read -r sid root <"$fixture"
  if ! drive_ready "$sid"; then
    [ "${CODE:0:1}" = 2 ] || [ "$CODE" = 404 ] || fail "$(why 'the shared drive')"
    rm -f "$fixture"
  fi
fi
if [ ! -s "$fixture" ]; then
  err="$(make_drive 2>&1)" || fail "setup: $err"
fi
read -r sid root <"$fixture"

# alice -> bob
a="$(make_dir "$CHAOS_USER" "$root" "by-$CHAOS_USER-$TOKEN_ID" 2>&1)" || fail "$a"
cleanup_file "$CHAOS_USER" "$a"
api "$CHAOS_USER2" GET "/sharings/drives/$sid/$root" || fail "$(why "the shared drive seen by $CHAOS_USER2")"
jq -e --arg a "$a" 'any(.data.relationships.contents.data[]?; .id == $a) or any(.included[]?; .id == $a)' <<<"$BODY" >/dev/null \
  || fail "the folder created by $CHAOS_USER is not in the shared drive seen by $CHAOS_USER2"
# bob -> alice
api "$CHAOS_USER2" POST "/sharings/drives/$sid/$root?Type=directory&Name=by-$CHAOS_USER2-$TOKEN_ID" \
  || fail "$(why "the creation of a folder by $CHAOS_USER2")"
b="$(jq -r '.data.id' <<<"$BODY")"
cleanup_file "$CHAOS_USER" "$b"
api "$CHAOS_USER" GET "/files/$b" || fail "$(why "the folder created by $CHAOS_USER2, seen by $CHAOS_USER")"
[ "$(jq -r '.data.attributes.dir_id' <<<"$BODY")" = "$root" ] || fail "the folder created by $CHAOS_USER2 is not in the shared drive"
ok "$CHAOS_USER and $CHAOS_USER2 each see the folder the other created in the shared drive ($(elapsed))"
