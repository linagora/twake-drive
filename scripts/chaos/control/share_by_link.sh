#!/bin/bash
# A user shares a folder by link (POST /permissions?codes=email, as Drive's "share by link"): a sharecode, with which
# whoever has the link lists the folder (GET /files/:id, the sharecode as bearer, as the public view does) and nothing
# else; the link revoked afterwards (DELETE /permissions/:id). Metadata only. The folder is a fixture: no write to the
# files before the sharing.
. "$(dirname "$0")/lib.sh"

dir="$(work_dir "$CHAOS_USER" 2>&1)" || fail "$dir"
d="$(ensure_dir_fixture shared-by-link 2>&1)" || fail "setup: $d"
api "$CHAOS_USER" POST "/permissions?codes=email" -H 'Content-Type: application/vnd.api+json' --data-binary \
  "$(jq -nc --arg d "$d" '{data:{type:"io.cozy.permissions", attributes:{permissions:{files:{type:"io.cozy.files", verbs:["GET"], values:[$d]}}}}}')" \
  || fail "$(why 'the share by link')"
pid="$(jq -r '.data.id' <<<"$BODY")"
code="$(jq -r '.data.attributes.shortcodes.email // .data.attributes.codes.email // empty' <<<"$BODY")"
[ -n "$code" ] || fail "no sharecode in $(head -c 200 <<<"$BODY")"
cleanup api "$CHAOS_USER" DELETE "/permissions/$pid"
public() { curl -s -m "$(ct)" -o "$WORK/pub" -w '%{http_code}' -H "Host: $CHAOS_INSTANCE" -H "Authorization: Bearer $code" "$CHAOS_STACK_URL$1"; }
c="$(public "/files/$d")"
[ "$c" = 200 ] || fail "the folder with the link: HTTP $c $(head -c 200 "$WORK/pub")"
jq -e --arg d "$d" '.data.id == $d' "$WORK/pub" >/dev/null || fail "the link opens another folder"
c="$(public "/files/$dir")"
[ "$c" = 403 ] || fail "the link opens a folder not shared: HTTP $c"
ok "a folder shared by link and opened with it ($(elapsed))"
