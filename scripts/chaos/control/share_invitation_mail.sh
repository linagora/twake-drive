#!/bin/bash
# A user shares a folder with someone by their email (POST /sharings/, a recipient without a Twake instance known): the
# invitation is sent by mail (the "sendmail" job: Redis, SMTP) and arrives in the recipient's mailbox (Mailpit) with the
# link to the sharing. The sharing is revoked and the mail deleted afterwards.
. "$(dirname "$0")/lib.sh"

dir="$(work_dir "$CHAOS_USER" 2>&1)" || fail "$dir"
d="$(make_dir "$CHAOS_USER" "$dir" "invite-$TOKEN_ID" 2>&1)" || fail "$d"
cleanup_file "$CHAOS_USER" "$d"
rcpt="invite-$TOKEN_ID@example.net"
api "$CHAOS_USER" POST /sharings/ -H 'Content-Type: application/vnd.api+json' --data-binary "$(jq -nc --arg d "$d" --arg r "$rcpt" --arg t "invite-$TOKEN_ID" '
  {data:{type:"io.cozy.sharings", attributes:{description:$t, rules:[{title:$t, doctype:"io.cozy.files", values:[$d], add:"sync", update:"sync", remove:"sync"}]},
         relationships:{recipients:{data:[{type:"io.cozy.contacts", email:$r}]}}}}')" || fail "$(why 'the sharing')"
sid="$(jq -r '.data.id' <<<"$BODY")"
cleanup api "$CHAOS_USER" DELETE "/sharings/$sid/recipients"
while :; do
  found="$(curl -s -m "$(ct)" "$CHAOS_MAIL_URL/api/v1/search?query=$(jq -rn --arg q "to:$rcpt" '$q|@uri')")" \
    || fail "the mailbox (Mailpit) does not answer"
  mid="$(jq -r '.messages[0].ID // empty' <<<"$found")"
  [ -n "$mid" ] && break
  [ "$(remaining)" -gt 0 ] || fail "no invitation received after ${BUDGET}s"
  sleep 0.5
done
cleanup curl -s -m 5 -X DELETE -H 'Content-Type: application/json' -d "$(jq -nc --arg m "$mid" '{IDs:[$m]}')" "$CHAOS_MAIL_URL/api/v1/messages"
msg="$(curl -s -m "$(ct)" "$CHAOS_MAIL_URL/api/v1/message/$mid")" || fail "the mail received cannot be read (Mailpit)"
jq -e --arg s "$sid" '.Text | contains("/sharings/" + $s + "/discovery")' <<<"$msg" >/dev/null \
  || fail "the invitation has no link to the sharing: $(jq -r '.Text' <<<"$msg" | head -c 200)"
ok "the invitation to a sharing received by mail ($(elapsed))"
