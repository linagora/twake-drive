# Shared by build.sh, start.sh, stop.sh and the control scripts of the chaos stack of Twake Drive. Not run on its own.
CHAOS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# the checkout under test: the one this folder is in (CHAOS_REPO_DIR: another, e.g. the worktree of twake-chaos)
REPO_DIR="${CHAOS_REPO_DIR:-$(cd "$CHAOS_DIR/../.." && pwd)}"
export CHAOS_PROJECT="${CHAOS_PROJECT:-drive-chaos}"
export CHAOS_STACK_PORT="${CHAOS_STACK_PORT:-19800}"         # cozy-stack, the API of the instances (and Drive)
export CHAOS_ADMIN_PORT="${CHAOS_ADMIN_PORT:-19801}"         # cozy-stack, the admin API (basic auth: admin / $CHAOS_ADMIN_PASSPHRASE)
export CHAOS_SSO_PORT="${CHAOS_SSO_PORT:-19802}"             # LemonLDAP (Host: $CHAOS_SSO_HOST)
export CHAOS_COUCHDB_PORT="${CHAOS_COUCHDB_PORT:-19803}"     # the load balancer in front of the CouchDB cluster
export CHAOS_S3_PORT="${CHAOS_S3_PORT:-19804}"               # MinIO, the S3 API
export CHAOS_ONLYOFFICE_PORT="${CHAOS_ONLYOFFICE_PORT:-19805}"
export CHAOS_MAIL_PORT="${CHAOS_MAIL_PORT:-19806}"           # Mailpit, its web UI and API (/api/v1/messages)
# what start.sh writes for the control scripts, between start and stop
export CHAOS_RUN="${CHAOS_RUN:-${XDG_CACHE_HOME:-$HOME/.cache}/twake-chaos/$CHAOS_PROJECT}"

# The image of the application: cozy-stack with the build of Drive of this commit in /opt/drive (build.sh). DRIVE_IMAGE
# given (a published one, with the same layout): pulled instead. The cozy-stack it starts from: COZY_STACK_IMAGE (the
# one of the repository's e2e stack), or built from a cozy-stack checkout when COZY_STACK_DIR is set.
BUILT_IMAGE="$CHAOS_PROJECT-drive:latest"
export DRIVE_IMAGE="${DRIVE_IMAGE:-$BUILT_IMAGE}"
COZY_STACK_IMAGE="${COZY_STACK_IMAGE:-cozy/cozy-stack:latest}"

# Instances: <name>.$CHAOS_DOMAIN, the port in the domain as cozy-stack sees it (Host header); flat subdomains
# (<name>-drive.$CHAOS_DOMAIN). From the host: curl -H "Host: $CHAOS_INSTANCE" http://127.0.0.1:$CHAOS_STACK_PORT/...
export CHAOS_ROOT_DOMAIN=chaos.localhost
export CHAOS_DOMAIN="$CHAOS_ROOT_DOMAIN:8080"
export CHAOS_INSTANCE="alice.$CHAOS_DOMAIN" CHAOS_INSTANCE2="bob.$CHAOS_DOMAIN"
# the accounts (LDAP seed, conf/ldap/10-seed.ldif): password "secret"; instance = <uid>.$CHAOS_DOMAIN
export CHAOS_USER=alice CHAOS_USER2=bob CHAOS_PASSWORD=secret
export CHAOS_EMAIL=alice@tmail.com CHAOS_EMAIL2=bob@tmail.com
# the SSO: LemonLDAP's OIDC client "twake-drive" (cozy-stack's, password grant allowed for the control scripts)
export CHAOS_OIDC_CLIENT=twake-drive CHAOS_OIDC_SECRET=twake-drive CHAOS_SSO_HOST=sso.example.com
export CHAOS_ADMIN_PASSPHRASE=cozy
export CHAOS_COUCHDB_USER=admin CHAOS_COUCHDB_PASSWORD=password
export CHAOS_S3_ACCESS_KEY=chaos CHAOS_S3_SECRET_KEY=chaos-secret-key CHAOS_S3_BUCKET=drive-chaos

compose() {
  docker compose -p "$CHAOS_PROJECT" -f "$CHAOS_DIR/compose.yaml" "$@"
}

# health of a service's container: healthy, starting, unhealthy, running (no healthcheck), exited...
service_state() {
  local id
  id="$(compose ps -aq "$1" 2>/dev/null | head -1)"
  [ -n "$id" ] || { echo missing; return; }
  docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$id" 2>/dev/null || echo missing
}

wait_healthy() {  # wait_healthy <seconds> <service>...
  local timeout="$1"; shift
  local deadline=$((SECONDS + timeout)) s
  for s in "$@"; do
    until [ "$(service_state "$s")" = healthy ]; do
      if [ $SECONDS -ge $deadline ]; then
        echo "$s is not healthy after ${timeout}s ($(service_state "$s"))" >&2
        compose logs --tail 80 "$s" >&2
        return 1
      fi
      sleep 3
    done
  done
}

# The CouchDB cluster whole: each node sees the 3 nodes connected, and the load balancer has the 3 back in rotation.
couchdb_healthy() {
  local i n
  for i in 1 2 3; do
    n="$(compose exec -T "couchdb$i" curl -sf -m 5 -u "$CHAOS_COUCHDB_USER:$CHAOS_COUCHDB_PASSWORD" http://localhost:5984/_membership \
      | python3 -c 'import json,sys; m=json.load(sys.stdin); print(len(set(m["all_nodes"]) & set(m["cluster_nodes"])))' 2>/dev/null)"
    [ "$n" = 3 ] || return 1
  done
  n="$(compose exec -T couchdb1 curl -sf -m 5 'http://couchdb-lb:8404/stats;csv' | grep -c '^couchdb_nodes,couchdb[123],.*,UP,')"
  [ "$n" = 3 ]
}

# The Redis Sentinel set whole: the 3 sentinels agree on the master, see it up and see each other, none is in TILT (a
# sentinel whose node was paused or starved stops acting for 30s once it runs again: a failover in that window lacks
# its quorum), and the master has its 2 replicas online.
redis_sentinel() {  # redis_sentinel <node> <sentinel command>...
  local node="$1"; shift
  compose exec -T "$node" timeout 5 redis-cli -p 26379 --raw sentinel "$@" | tr -d '\r'
}
redis_master() {
  redis_sentinel "${1:-redis1}" get-master-addr-by-name chaos | head -1
}
redis_healthy() {
  local master s info
  master="$(redis_master redis1)"
  [ -n "$master" ] || return 1
  for s in redis1 redis2 redis3; do
    [ "$(redis_master "$s")" = "$master" ] || return 1
    info="$(redis_sentinel "$s" master chaos)" || return 1
    [ "$(echo "$info" | grep -A1 -x flags | tail -1)" = master ] || return 1
    [ "$(echo "$info" | grep -A1 -x num-other-sentinels | tail -1)" = 2 ] || return 1
    compose exec -T "$s" timeout 5 redis-cli -p 26379 info sentinel | grep -q '^sentinel_tilt:0' || return 1
  done
  [ "$(compose exec -T "$master" timeout 5 redis-cli info replication | grep -c 'state=online')" = 2 ]
}
