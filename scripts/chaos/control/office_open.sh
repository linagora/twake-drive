#!/bin/bash
# A user opens an office document (a .docx of their Drive): the instance gives the parameters of the Document Server
# (GET /office/:id/open: its URL, a signed config, the document's download URL), the browser loads the editor's api.js
# from the Document Server, and the Document Server loads the document from the instance (as its file converter does on
# opening: ConvertService, the JWT signed with the inbox secret of conf/stack/cozy.yml). The document is a fixture.
. "$(dirname "$0")/lib.sh"
. "$CONTROL_DIR/office.sh"

docx_fixture() { py docx "$1" "chaos fixture document"; }
id="$(ensure_fixture docx letter.docx docx_fixture "$DOCX_TYPE" 2>&1)" || fail "setup: $id"
office_open "$id" || fail "$(why 'the opening of the document')"
code="$(curl -s -m "$(ct)" -o "$WORK/api.js" -w '%{http_code}' "$CHAOS_ONLYOFFICE_URL/web-apps/apps/api/documents/api.js")"
[ "$code" = 200 ] && grep -q DocsAPI "$WORK/api.js" || fail "the editor (api.js) of the Document Server: HTTP $code"
out="$(ds_load "$OO_DOC_URL" docx 2>&1)" || fail "$out"
ok "an office document opened and loaded by the Document Server ($(elapsed))"
