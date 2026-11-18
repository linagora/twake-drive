#!/bin/bash
# A user deletes for good a folder of the trash holding a file (DELETE /files/trash/:id): the folder and its file are
# gone, their contents removed by the "trash-files" job (Redis). The file is uploaded first (S3).
. "$(dirname "$0")/lib.sh"

dir="$(work_dir "$CHAOS_USER" 2>&1)" || fail "$dir"
d="$(make_dir "$CHAOS_USER" "$dir" "empty-$TOKEN_ID" 2>&1)" || fail "$d"
cleanup_file "$CHAOS_USER" "$d"
printf 'chaos trash %s\n' "$TOKEN_ID" >"$WORK/t.txt"
f="$(upload "$CHAOS_USER" "$d" "in-trash-$TOKEN_ID.txt" "$WORK/t.txt" text/plain 2>&1)" || fail "setup: $f"
api "$CHAOS_USER" DELETE "/files/$d" || fail "$(why 'move to the trash')"
api "$CHAOS_USER" DELETE "/files/trash/$d" || fail "$(why 'delete for good')"
api "$CHAOS_USER" GET "/files/$d"
[ "$CODE" = 404 ] || fail "$(why 'the folder deleted for good is still there')"
api "$CHAOS_USER" GET "/files/$f"
[ "$CODE" = 404 ] || fail "$(why 'the file of the folder deleted for good is still there')"
ok "a folder and its file deleted for good from the trash ($(elapsed))"
