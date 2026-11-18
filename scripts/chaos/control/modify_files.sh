#!/bin/bash
# A user organizes their files: creates two folders, renames one and moves it into the other (PATCH /files/:id, under the
# VFS lock in Redis); the folder is found by its new path. Metadata only (no content in S3).
. "$(dirname "$0")/lib.sh"

dir="$(work_dir "$CHAOS_USER" 2>&1)" || fail "$dir"
a="$(make_dir "$CHAOS_USER" "$dir" "modify-$TOKEN_ID-a" 2>&1)" || fail "$a"
cleanup_file "$CHAOS_USER" "$a"
b="$(make_dir "$CHAOS_USER" "$dir" "modify-$TOKEN_ID-b" 2>&1)" || fail "$b"
cleanup_file "$CHAOS_USER" "$b"

patch() {  # patch <id> <attributes JSON>
  api "$CHAOS_USER" PATCH "/files/$1" -H 'Content-Type: application/vnd.api+json' \
    --data-binary "$(jq -nc --arg id "$1" --argjson a "$2" '{data:{type:"io.cozy.files", id:$id, attributes:$a}}')"
}
patch "$b" "$(jq -nc --arg n "modify-$TOKEN_ID-renamed" '{name:$n}')" || fail "$(why rename)"
[ "$(jq -r '.data.attributes.name' <<<"$BODY")" = "modify-$TOKEN_ID-renamed" ] || fail "rename: the name did not change"
patch "$b" "$(jq -nc --arg d "$a" '{dir_id:$d}')" || fail "$(why move)"
api "$CHAOS_USER" GET "/files/metadata?Path=/chaos-control/modify-$TOKEN_ID-a/modify-$TOKEN_ID-renamed" \
  || fail "$(why 'the folder at its new path')"
[ "$(jq -r '.data.id' <<<"$BODY")" = "$b" ] || fail "another folder at the new path"
ok "folders created, renamed and moved ($(elapsed))"
