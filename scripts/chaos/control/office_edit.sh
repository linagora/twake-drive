#!/bin/bash
# A user edits an office document and OnlyOffice saves it: the document opened (GET /office/:id/open), its edited
# version made by the Document Server (from the document it loads from the instance), then the Document Server's save
# callback (POST /office/callback, status 2 "ready for saving", signed with the outbox secret): the instance downloads
# the edited version from the Document Server and writes it as a new version of the file (S3, the VFS lock in Redis).
. "$(dirname "$0")/lib.sh"
. "$CONTROL_DIR/office.sh"

dir="$(work_dir "$CHAOS_USER" 2>&1)" || fail "$dir"
py docx "$WORK/d.docx" "chaos edit $TOKEN_ID"
id="$(upload "$CHAOS_USER" "$dir" "edit-$TOKEN_ID.docx" "$WORK/d.docx" "$DOCX_TYPE" 2>&1)" || fail "setup: $id"
cleanup_file "$CHAOS_USER" "$id"
api "$CHAOS_USER" GET "/files/$id" || fail "$(why 'the document')"
rev="$(jq -r '.data.meta.rev' <<<"$BODY")"
office_open "$id" || fail "$(why 'the opening of the document')"
edited="$(ds_load "$OO_DOC_URL" docx 2>&1)" || fail "$edited"

payload="$(jq -nc --arg k "$OO_KEY" --arg u "$edited" '{key:$k, status:2, url:$u}')"
jwt="$(py jwt "$OO_SECRET" "$(jq -nc --argjson p "$payload" '{payload:$p}')")" || broken "cannot sign the callback"
code="$(curl -s -m "$(ct)" -o "$WORK/cb" -w '%{http_code}' -H "Host: $CHAOS_INSTANCE" -H "Authorization: Bearer $jwt" \
  -H 'Content-Type: application/json' --data-binary "$payload" "$CHAOS_STACK_URL/office/callback")"
[ "$code" = 200 ] && jq -e '.error == 0' "$WORK/cb" >/dev/null 2>&1 || fail "the save callback: HTTP $code $(head -c 200 "$WORK/cb")"
api "$CHAOS_USER" GET "/files/$id" || fail "$(why 'the document saved')"
[ "$(jq -r '.data.meta.rev' <<<"$BODY")" != "$rev" ] && [ "$(jq -r '.data.attributes.cozyMetadata.uploadedBy.slug // empty' <<<"$BODY")" = onlyoffice-server ] \
  || fail "the document is not saved by OnlyOffice: $(jq -c '.data.attributes.cozyMetadata.uploadedBy' <<<"$BODY")"
ok "an office document edited and saved through OnlyOffice ($(elapsed))"
