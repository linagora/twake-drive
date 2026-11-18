#!/bin/bash
# A user browses their files as Drive queries them (src/queries): the root folder (GET /files/:dir-id), the content of a
# folder (POST /files/_find on dir_id, type, name: Drive's folder view) and the recent files (updated_at desc: Drive's
# recent view), each on its Mango index (POST /data/io.cozy.files/_index, as cozy-client creates it). Metadata only
# (CouchDB), with the token the client holds.
. "$(dirname "$0")/lib.sh"

api "$CHAOS_USER" GET "/files/io.cozy.files.root-dir" || fail "$(why 'the root folder')"
jq -e '.data.id == "io.cozy.files.root-dir"' <<<"$BODY" >/dev/null || fail "the root folder answered is not the root"
dir="$(work_dir "$CHAOS_USER" 2>&1)" || fail "$dir"

json=(-H 'Content-Type: application/json')
api "$CHAOS_USER" POST /data/io.cozy.files/_index "${json[@]}" \
  --data-binary '{"index":{"fields":["dir_id","type","name"]},"ddoc":"chaos-folder-view"}' || fail "$(why 'the folder view index')"
api "$CHAOS_USER" POST /files/_find "${json[@]}" --data-binary "$(jq -nc --arg d "$dir" \
  '{selector:{dir_id:$d, type:"file", name:{"$gt":null}}, sort:[{dir_id:"asc"},{type:"asc"},{name:"asc"}], use_index:"_design/chaos-folder-view", limit:100}')" \
  || fail "$(why 'the content of /chaos-control')"
jq -e '.data | type == "array"' <<<"$BODY" >/dev/null || fail "the content of /chaos-control is not a list"

api "$CHAOS_USER" POST /data/io.cozy.files/_index "${json[@]}" \
  --data-binary '{"index":{"fields":["updated_at"],"partial_filter_selector":{"type":"file","trashed":false}},"ddoc":"chaos-recent-view"}' \
  || fail "$(why 'the recent view index')"
api "$CHAOS_USER" POST /files/_find "${json[@]}" --data-binary \
  '{"selector":{"updated_at":{"$gt":null}},"sort":[{"updated_at":"desc"}],"use_index":"_design/chaos-recent-view","limit":50}' \
  || fail "$(why 'the recent files')"
jq -e '.data | type == "array"' <<<"$BODY" >/dev/null || fail "the recent files are not a list"
ok "the root, a folder's content and the recent files listed ($(elapsed))"
