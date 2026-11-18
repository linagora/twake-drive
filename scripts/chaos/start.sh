#!/bin/bash
#
# Starts the chaos stack of Twake Drive: the backing services first, the CouchDB cluster joined (3 nodes, the system
# databases created once they are all in) and checked through the load balancer, the Redis Sentinel set checked (formed
# by the nodes themselves, conf/redis/node.sh), then cozy-stack, healthy with its dependencies (/status), the instances
# of alice and bob (context "chaos", Drive of the commit installed), and checks that an account signs in through the SSO
# (password grant on LemonLDAP, then POST /oidc/access_token on its instance) and reaches the files API, writing a file
# and reading it back. Writes $CHAOS_RUN/env: what the control scripts read.
#
set -euo pipefail
. "$(dirname "$0")/common.sh"

mkdir -p "$CHAOS_RUN"

echo "==> The backing services, compose project '$CHAOS_PROJECT'"
INFRA=$(compose config --services | grep -vx stack)
compose up -d $INFRA
wait_healthy 300 couchdb1 couchdb2 couchdb3 redis1 redis2 redis3 s3

echo "==> The CouchDB cluster"
couch() {  # couch <node> <curl arguments>...
  local node="$1"; shift
  compose exec -T "$node" curl -s -m 10 -u "$CHAOS_COUCHDB_USER:$CHAOS_COUCHDB_PASSWORD" "$@"
}
for i in 2 3; do
  if ! couch couchdb1 http://localhost:5984/_membership | grep -q "\"couchdb@couchdb$i.chaos\""; then
    couch couchdb1 -X PUT "http://localhost:5984/_node/_local/_nodes/couchdb@couchdb$i.chaos" -d '{}' >/dev/null
  fi
done
for i in $(seq 1 60); do
  couchdb_healthy && break
  [ "$i" = 60 ] && { echo "the CouchDB cluster is not whole" >&2; couch couchdb1 http://localhost:5984/_membership >&2; exit 1; }
  sleep 2
done
# one uuid for the cluster, as CouchDB's cluster setup does (the image gives each node its own)
for i in 1 2 3; do
  couch "couchdb$i" -X PUT http://localhost:5984/_node/_local/_config/couchdb/uuid -d '"6c0d1f3a9b2e4c7d8e5f0a1b2c3d4e5f"' >/dev/null
done
# the system databases, once the 3 nodes are in: their shards on the 3 (n=3)
for db in _users _replicator; do
  couch couchdb1 -X PUT "http://localhost:5984/$db" >/dev/null
  couch couchdb1 -f -o /dev/null "http://localhost:5984/$db" || { echo "cannot create $db" >&2; exit 1; }
done
n="$(couch couchdb1 http://localhost:5984/_users/_shards | python3 -c 'import json,sys; print(min(len(v) for v in json.load(sys.stdin)["shards"].values()))')"
[ "$n" = 3 ] || { echo "_users has $n cop(ies) of its shards, not 3" >&2; exit 1; }
curl -sf -o /dev/null -u "$CHAOS_COUCHDB_USER:$CHAOS_COUCHDB_PASSWORD" "http://127.0.0.1:$CHAOS_COUCHDB_PORT/_users" \
  || { echo "CouchDB does not answer through the load balancer" >&2; exit 1; }

echo "==> The Redis Sentinel set"
for i in $(seq 1 60); do
  redis_healthy && break
  [ "$i" = 60 ] && { echo "the Redis Sentinel set is not whole" >&2; redis_sentinel redis1 master chaos >&2 || true; exit 1; }
  sleep 2
done

# what the control scripts read (written before cozy-stack: a failed start can still be investigated with them)
cat > "$CHAOS_RUN/env" <<EOF
export CHAOS_PROJECT=$CHAOS_PROJECT
export CHAOS_STACK_URL=http://127.0.0.1:$CHAOS_STACK_PORT CHAOS_ADMIN_URL=http://127.0.0.1:$CHAOS_ADMIN_PORT CHAOS_ADMIN_PASSPHRASE=$CHAOS_ADMIN_PASSPHRASE
export CHAOS_DOMAIN=$CHAOS_DOMAIN CHAOS_INSTANCE=$CHAOS_INSTANCE CHAOS_INSTANCE2=$CHAOS_INSTANCE2
export CHAOS_USER=$CHAOS_USER CHAOS_USER2=$CHAOS_USER2 CHAOS_PASSWORD=$CHAOS_PASSWORD CHAOS_EMAIL=$CHAOS_EMAIL CHAOS_EMAIL2=$CHAOS_EMAIL2
export CHAOS_SSO_URL=http://127.0.0.1:$CHAOS_SSO_PORT CHAOS_SSO_HOST=$CHAOS_SSO_HOST
export CHAOS_OIDC_CLIENT=$CHAOS_OIDC_CLIENT CHAOS_OIDC_SECRET=$CHAOS_OIDC_SECRET
export CHAOS_COUCHDB_URL=http://127.0.0.1:$CHAOS_COUCHDB_PORT CHAOS_COUCHDB_USER=$CHAOS_COUCHDB_USER CHAOS_COUCHDB_PASSWORD=$CHAOS_COUCHDB_PASSWORD
export CHAOS_S3_URL=http://127.0.0.1:$CHAOS_S3_PORT CHAOS_S3_ACCESS_KEY=$CHAOS_S3_ACCESS_KEY CHAOS_S3_SECRET_KEY=$CHAOS_S3_SECRET_KEY CHAOS_S3_BUCKET=$CHAOS_S3_BUCKET
export CHAOS_ONLYOFFICE_URL=http://127.0.0.1:$CHAOS_ONLYOFFICE_PORT CHAOS_MAIL_URL=http://127.0.0.1:$CHAOS_MAIL_PORT
EOF

echo "==> cozy-stack ($DRIVE_IMAGE)"
compose up -d stack
wait_healthy 300 stack
for i in $(seq 1 30); do
  status="$(curl -s -m 10 "http://127.0.0.1:$CHAOS_STACK_PORT/status" || true)"
  echo "$status" | grep -q '"status":"OK"' && break
  [ "$i" = 30 ] && { echo "cozy-stack's /status is not OK: $status" >&2; exit 1; }
  sleep 2
done

echo "==> The instances, Drive of the commit installed"
stack() { compose exec -T stack cozy-stack "$@"; }
for pair in "$CHAOS_INSTANCE:$CHAOS_EMAIL" "$CHAOS_INSTANCE2:$CHAOS_EMAIL2"; do
  inst="${pair%:*}" email="${pair##*:}"
  if ! stack instances show "$inst" >/dev/null 2>&1; then
    # what the control scripts kept (OAuth clients, tokens, sessions, fixtures) was of the instances gone
    rm -rf "$CHAOS_RUN/control"
    stack instances add --context-name chaos --email "$email" --locale en --passphrase "$CHAOS_PASSWORD" "$inst" >/dev/null
  fi
  stack apps ls --domain "$inst" | grep -qw drive || stack apps install drive file:///opt/drive --domain "$inst" >/dev/null
done
stack features defaults '{"drive.office": {"enabled": true, "write": true}}' >/dev/null

echo "==> Every database has a copy of its shards on each node"
# n=3: conf/haproxy/haproxy.cfg rewrites the n=1 cozy-stack --dev asks for
under3="$(python3 -I - "http://127.0.0.1:$CHAOS_COUCHDB_PORT" "$CHAOS_COUCHDB_USER:$CHAOS_COUCHDB_PASSWORD" <<'EOF'
import base64, json, sys, urllib.parse, urllib.request
url, auth = sys.argv[1], {"Authorization": "Basic " + base64.b64encode(sys.argv[2].encode()).decode()}
get = lambda p: json.load(urllib.request.urlopen(urllib.request.Request(url + p, headers=auth), timeout=10))
for db in get("/_all_dbs"):
    copies = min(len(v) for v in get("/" + urllib.parse.quote(db, safe="") + "/_shards")["shards"].values())
    if copies != 3:
        print(f"{db}: {copies}")
EOF
)" || { echo "cannot list the shards of the databases" >&2; exit 1; }
[ -z "$under3" ] || { echo "databases without a copy on each node:" >&2; echo "$under3" >&2; exit 1; }

echo "==> OnlyOffice"
wait_healthy 600 onlyoffice

echo "==> An account signs in (SSO, password grant), its instance exchanges the token, the files API answers"
host=(-H "Host: $CHAOS_INSTANCE")
client="$(curl -sf "${host[@]}" -H 'Content-Type: application/json' -H 'Accept: application/json' \
  -d '{"redirect_uris":["http://localhost/chaos"],"client_name":"twake-chaos","software_id":"github.com/linagora/twake-chaos"}' \
  "http://127.0.0.1:$CHAOS_STACK_PORT/auth/register")" || { echo "cannot register an OAuth client on $CHAOS_INSTANCE" >&2; exit 1; }
client_id="$(echo "$client" | python3 -c 'import json,sys; print(json.load(sys.stdin)["client_id"])')"
client_secret="$(echo "$client" | python3 -c 'import json,sys; print(json.load(sys.stdin)["client_secret"])')"
# quoted: the file is sourced, the values are the stack's answer
{
  echo "# an OAuth client of $CHAOS_INSTANCE: POST /oidc/access_token {client_id, client_secret, scope, oidc_token: <SSO token>}"
  printf 'export CHAOS_CLIENT_ID=%q CHAOS_CLIENT_SECRET=%q\n' "$client_id" "$client_secret"
} >> "$CHAOS_RUN/env"
for i in $(seq 1 40); do
  sso_token="$(curl -s -H "Host: $CHAOS_SSO_HOST" -u "$CHAOS_OIDC_CLIENT:$CHAOS_OIDC_SECRET" \
    -d grant_type=password -d "username=$CHAOS_USER" -d "password=$CHAOS_PASSWORD" -d 'scope=openid email profile' \
    "http://127.0.0.1:$CHAOS_SSO_PORT/oauth2/token" | sed -n 's/.*"access_token" *: *"\([^"]*\)".*/\1/p')"
  token=""
  if [ -n "$sso_token" ]; then
    token="$(curl -s "${host[@]}" -H 'Content-Type: application/json' -H 'Accept: application/json' \
      -d "{\"client_id\":\"$client_id\",\"client_secret\":\"$client_secret\",\"scope\":\"io.cozy.files\",\"oidc_token\":\"$sso_token\"}" \
      "http://127.0.0.1:$CHAOS_STACK_PORT/oidc/access_token" | sed -n 's/.*"access_token" *: *"\([^"]*\)".*/\1/p')"
  fi
  [ -n "$token" ] && curl -sf -o /dev/null "${host[@]}" -H "Authorization: Bearer $token" \
    "http://127.0.0.1:$CHAOS_STACK_PORT/files/io.cozy.files.root-dir" && break
  [ "$i" = 40 ] && { echo "$CHAOS_USER cannot reach the files API of $CHAOS_INSTANCE through the SSO" >&2; exit 1; }
  sleep 3
done
content="chaos $(date +%s)"
file_id="$(curl -sf "${host[@]}" -H "Authorization: Bearer $token" -H 'Content-Type: text/plain' --data-binary "$content" \
  "http://127.0.0.1:$CHAOS_STACK_PORT/files/io.cozy.files.root-dir?Type=file&Name=chaos-start-$(date +%s).txt" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["data"]["id"])')" || { echo "cannot upload a file" >&2; exit 1; }
[ "$(curl -sf "${host[@]}" -H "Authorization: Bearer $token" "http://127.0.0.1:$CHAOS_STACK_PORT/files/download/$file_id")" = "$content" ] \
  || { echo "the file uploaded does not read back" >&2; exit 1; }

echo "==> Ready: the API http://127.0.0.1:$CHAOS_STACK_PORT (Host: $CHAOS_INSTANCE), admin $CHAOS_ADMIN_PORT, SSO $CHAOS_SSO_PORT, CouchDB $CHAOS_COUCHDB_PORT, S3 $CHAOS_S3_PORT, OnlyOffice $CHAOS_ONLYOFFICE_PORT, mails $CHAOS_MAIL_PORT ($CHAOS_RUN/env)"
