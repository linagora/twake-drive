#!/bin/bash
# A user moves a folder to the trash (DELETE /files/:id), finds it in the trash (GET /files/trash) and restores it
# (POST /files/trash/:id): it is back in its folder. Metadata only, under the VFS lock in Redis.
. "$(dirname "$0")/lib.sh"

dir="$(work_dir "$CHAOS_USER" 2>&1)" || fail "$dir"
name="trash-$TOKEN_ID"
id="$(make_dir "$CHAOS_USER" "$dir" "$name" 2>&1)" || fail "$id"
cleanup_file "$CHAOS_USER" "$id"
api "$CHAOS_USER" DELETE "/files/$id" || fail "$(why 'move to the trash')"
[ "$(jq -r '.data.attributes.dir_id' <<<"$BODY")" = io.cozy.files.trash-dir ] || fail "the folder is not in the trash"
api "$CHAOS_USER" GET "/files/trash?page%5Blimit%5D=1000" || fail "$(why 'the trash')"
jq -e --arg id "$id" 'any(.data[]; .id == $id)' <<<"$BODY" >/dev/null || fail "the folder is not listed in the trash"
api "$CHAOS_USER" POST "/files/trash/$id" || fail "$(why restore)"
api "$CHAOS_USER" GET "/files/metadata?Path=/chaos-control/$name" || fail "$(why 'the folder restored')"
[ "$(jq -r '.data.id' <<<"$BODY")" = "$id" ] || fail "another folder where the restored one should be"
ok "moved to the trash and restored ($(elapsed))"
