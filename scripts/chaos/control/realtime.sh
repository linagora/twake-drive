#!/bin/bash
# Drive's live view: its websocket (GET /realtime/, io.cozy.websocket, as cozy-realtime and FilesRealTimeQueries)
# subscribed to io.cozy.files receives the event of a folder another client creates (the realtime hub in Redis).
. "$(dirname "$0")/lib.sh"

dir="$(work_dir "$CHAOS_USER" 2>&1)" || fail "$dir"
tok="$(token "$CHAOS_USER" 2>&1)" || fail "no token: $tok"
name="realtime-$TOKEN_ID"
wait_for=$(( $(remaining) - 5 )); [ $wait_for -lt 5 ] && wait_for=5
py realtime "ws://${CHAOS_STACK_URL#http://}/realtime/" "$CHAOS_INSTANCE" "$tok" io.cozy.files "$name" "$wait_for" "$WORK/ready" \
  >"$WORK/ws.out" 2>&1 &
ws=$!
until [ -e "$WORK/ready" ]; do
  kill -0 $ws 2>/dev/null || { wait $ws; rc=$?; [ $rc = 2 ] && fail "the websocket: $(tail -1 "$WORK/ws.out")"; fail "the websocket: $(tail -1 "$WORK/ws.out")"; }
  [ "$(remaining)" -gt 0 ] || fail "the websocket is not subscribed after ${BUDGET}s"
  sleep 0.1
done
id="$(make_dir "$CHAOS_USER" "$dir" "$name" 2>&1)" || { kill $ws 2>/dev/null; fail "setup: $id"; }
cleanup_file "$CHAOS_USER" "$id"
wait $ws; rc=$?
[ $rc = 0 ] || fail "the creation of a folder is not pushed: $(tail -1 "$WORK/ws.out")"
ok "the websocket notified of a new folder ($(elapsed))"
