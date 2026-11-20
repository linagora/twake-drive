#!/bin/bash
# A user uploads a file (POST /files/:dir-id, the VFS lock in Redis, the content in S3) and downloads it back
# (GET /files/download/:id): the same bytes.
. "$(dirname "$0")/lib.sh"

dir="$(work_dir "$CHAOS_USER" 2>&1)" || fail "$dir"
printf 'chaos upload %s\n' "$TOKEN_ID" >"$WORK/up.txt"
head -c 20000 /dev/urandom | base64 >>"$WORK/up.txt"
id="$(upload "$CHAOS_USER" "$dir" "upload-$TOKEN_ID.txt" "$WORK/up.txt" text/plain 2>&1)" || fail "$id"
cleanup_file "$CHAOS_USER" "$id"
api "$CHAOS_USER" GET "/files/download/$id" || fail "$(why download)"
cmp -s "$WORK/up.txt" "$WORK/body" || fail "the file downloaded differs from the one uploaded"
ok "uploaded and downloaded back, the same bytes ($(elapsed))"
