#!/bin/bash
# A user writes a note (Twake Notes, from Drive's "New note"): created (POST /notes, a file of the VFS: its content in
# S3), opened (GET /notes/:id/open), edited (PATCH /notes/:id with prosemirror steps, If-Match its version), saved to
# its file (POST /notes/:id/sync, under the VFS lock in Redis) and read back (GET /notes/:id/text holds the text).
. "$(dirname "$0")/lib.sh"

# the schema of cozy-stack's tests (web/notes), as the editor sends one
schema='{"nodes":[["doc",{"content":"block+"}],["paragraph",{"content":"inline*","group":"block"}],
  ["blockquote",{"content":"block+","group":"block"}],["horizontal_rule",{"group":"block"}],
  ["heading",{"content":"inline*","group":"block","attrs":{"level":{"default":1}}}],
  ["code_block",{"content":"text*","marks":"","group":"block"}],["text",{"group":"inline"}],
  ["image",{"group":"inline","inline":true,"attrs":{"alt":{},"src":{},"title":{}}}],
  ["hard_break",{"group":"inline","inline":true}],
  ["ordered_list",{"content":"list_item+","group":"block","attrs":{"order":{"default":1}}}],
  ["bullet_list",{"content":"list_item+","group":"block"}],["list_item",{"content":"paragraph block*"}]],
  "marks":[["link",{"attrs":{"href":{},"title":{}},"inclusive":false}],["em",{}],["strong",{}],["code",{}]],"topNode":"doc"}'
# created with a first paragraph: an empty note (what Drive's "New note" asks for) fails on this stack, see NOTES.md
api "$CHAOS_USER" POST /notes -H 'Content-Type: application/vnd.api+json' --data-binary \
  "$(jq -nc --arg t "note-$TOKEN_ID" --argjson s "$schema" '{data:{type:"io.cozy.notes.documents", attributes:{title:$t, schema:$s,
     content:{type:"doc", content:[{type:"paragraph", content:[{type:"text", text:"Title. "}]}]}}}}')" \
  || fail "$(why 'the creation of the note')"
id="$(jq -r '.data.id' <<<"$BODY")"
version="$(jq -r '.data.attributes.metadata.version // 0' <<<"$BODY")"
cleanup_file "$CHAOS_USER" "$id"
api "$CHAOS_USER" GET "/notes/$id/open" || fail "$(why 'the opening of the note')"
[ "$(jq -r '.data.attributes.note_id' <<<"$BODY")" = "$id" ] || fail "the note opened is another one"

text="chaos note $TOKEN_ID"
api "$CHAOS_USER" PATCH "/notes/$id" -H 'Content-Type: application/vnd.api+json' -H "If-Match: $version" --data-binary \
  "$(jq -nc --arg t "$text" --arg s "chaos-$TOKEN_ID" '{data:[{type:"io.cozy.notes.steps", attributes:{sessionID:$s, stepType:"replace", from:1, to:1, slice:{content:[{type:"text", text:$t}]}}}]}')" \
  || fail "$(why 'the edition of the note')"
api "$CHAOS_USER" POST "/notes/$id/sync" || fail "$(why 'the save of the note')"
api "$CHAOS_USER" GET "/notes/$id/text" || fail "$(why 'the text of the note')"
grep -qF "$text" <<<"$BODY" || fail "the note saved does not hold the text written: $(head -c 200 <<<"$BODY")"
ok "a note created, opened, edited and saved ($(elapsed))"
