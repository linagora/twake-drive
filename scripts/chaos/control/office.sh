# The OnlyOffice helpers of office_open.sh and office_edit.sh. Sourced after lib.sh, never run.

DOCX_TYPE=application/vnd.openxmlformats-officedocument.wordprocessingml.document
# the secrets of office.default (conf/stack/cozy.yml): the Document Server's JWT_SECRET
OO_SECRET=twake-chaos-office-secret

# office_open <file id>: GET /office/:id/open; sets OO_KEY and OO_DOC_URL (the document's download URL)
office_open() {
  api "$CHAOS_USER" GET "/office/$1/open" || return 1
  OO_KEY="$(jq -r '.data.attributes.onlyoffice.document.key // empty' <<<"$BODY")"
  OO_DOC_URL="$(jq -r '.data.attributes.onlyoffice.document.url // empty' <<<"$BODY")"
  [ -n "$OO_KEY" ] && [ -n "$OO_DOC_URL" ] && [ -n "$(jq -r '.data.attributes.onlyoffice.token // empty' <<<"$BODY")" ] \
    || { CODE="no Document Server parameters"; return 1; }
}

# ds_load <document url> <output type>: the Document Server fetches the document from the instance and converts it
# (ConvertService); prints the URL of the result, on the Document Server (Host: onlyoffice: the name the stack reaches)
ds_load() {
  local payload jwt resp url
  payload="$(jq -nc --arg u "$1" --arg o "$2" --arg k "chaos$TOKEN_ID$RANDOM" '{async:false, filetype:"docx", outputtype:$o, key:$k, title:"chaos.docx", url:$u}')"
  jwt="$(py jwt "$OO_SECRET" "$payload")" || { echo "cannot sign the request to the Document Server" >&2; return 1; }
  resp="$(curl -s -m "$(ct)" -H 'Host: onlyoffice' -H 'Accept: application/json' -H 'Content-Type: application/json' \
    -d "{\"token\":\"$jwt\"}" "$CHAOS_ONLYOFFICE_URL/ConvertService.ashx")" || { echo "the Document Server does not answer" >&2; return 1; }
  url="$(jq -r 'select(.endConvert == true) | .fileUrl // empty' <<<"$resp" 2>/dev/null)"
  [ -n "$url" ] || { echo "the Document Server does not load the document: $(head -c 200 <<<"$resp")" >&2; return 1; }
  printf '%s' "$url"
}
