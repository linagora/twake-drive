# Shared by the control scripts of the chaos stack of Twake Drive. Sourced, never run.
#
# Conventions: exit 0 the feature works, 1 it does not, 2 the probe itself is broken. The last line printed says why.
# The helpers print their result on stdout and return non zero on failure, their reason on stderr.
#
# The API is called as the Drive front calls it: on the instance (Host: alice.chaos.localhost:8080), a bearer token. The
# token is the one a signed-in client holds: obtained once through the SSO (password grant on LemonLDAP, exchanged on
# POST /oidc/access_token, valid 7 days), then reused (lib `token`); only sso_sign_in signs in anew each run.

CONTROL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../common.sh
. "$CONTROL_DIR/../common.sh"
if [ ! -r "$CHAOS_RUN/env" ]; then echo "BROKEN: no $CHAOS_RUN/env: start.sh has not run"; exit 2; fi
# shellcheck disable=SC1091
. "$CHAOS_RUN/env"

# state kept between runs (held tokens, sessions, fixtures): never needed, it only saves time
STATE_DIR="$CHAOS_RUN/control"
mkdir -p "$STATE_DIR" 2>/dev/null || { echo "BROKEN: cannot create $STATE_DIR"; exit 2; }
WORK="$(mktemp -d)" || { echo "BROKEN: no temporary directory"; exit 2; }

FEATURE="$(basename "$0" .sh)"
START=$SECONDS
# the budget of the script: twake-chaos kills it at its timeout_seconds, polling stops before, to say why
BUDGET="${CHAOS_CONTROL_BUDGET:-50}"
remaining() { echo $((START + BUDGET - SECONDS)); }
# the timeout of one call, bounded by the budget left. A slow answer is still an answer: twake-chaos times the scripts.
CALL_TIMEOUT=30
ct() { local r=$((START + BUDGET - SECONDS)); [ $r -gt $CALL_TIMEOUT ] && r=$CALL_TIMEOUT; [ $r -lt 3 ] && r=3; echo $r; }

TOKEN_ID="$(date +%s)-$RANDOM$RANDOM"
SCOPE="io.cozy.files io.cozy.contacts io.cozy.sharings io.cozy.permissions io.cozy.settings:GET io.cozy.jobs:GET"

# the reason on one line, the last one; what was created cleaned first
oneline() { local s="$*"; s="${s//$'\n'/ | }"; printf '%s\n' "${s:0:400}"; }
# cleanup <command> <args...>: run on exit. Kept as data (the count of words, then the words), never evaluated: the
# arguments include ids returned by the API.
CLEANUPS=()
cleanup() { CLEANUPS+=("$#" "$@"); }
on_exit() {
  local i=0 n
  while [ $i -lt ${#CLEANUPS[@]} ]; do
    n="${CLEANUPS[i]}"
    "${CLEANUPS[@]:i+1:n}" >/dev/null 2>&1 || true
    i=$((i + n + 1))
  done
  rm -rf "$WORK"
}
trap on_exit EXIT
ok()     { oneline "OK: $*"; exit 0; }
fail()   { oneline "FAIL: $*"; exit 1; }
broken() { oneline "BROKEN: $*"; exit 2; }
py()     { python3 -I "$CONTROL_DIR/lib.py" "$@"; }
elapsed() { echo "$((SECONDS - START))s"; }

instance_of() { case "$1" in "$CHAOS_USER") echo "$CHAOS_INSTANCE" ;; "$CHAOS_USER2") echo "$CHAOS_INSTANCE2" ;; *) return 1 ;; esac; }
# the URL of an instance as its users and the other instances know it
instance_url() { echo "http://$(instance_of "$1")"; }

# ---------------------------------------------------------------------------------------------------- the SSO
# sso_token <user>: a new access token from LemonLDAP (password grant, the password checked in LDAP)
sso_token() {
  local body tok
  body="$(curl -s -m "$(ct)" -H "Host: $CHAOS_SSO_HOST" -u "$CHAOS_OIDC_CLIENT:$CHAOS_OIDC_SECRET" \
    -d grant_type=password --data-urlencode "username=$1" --data-urlencode "password=$CHAOS_PASSWORD" \
    -d 'scope=openid email profile' "$CHAOS_SSO_URL/oauth2/token")" || { echo "the SSO is unreachable" >&2; return 1; }
  tok="$(jq -r '.access_token // empty' <<<"$body" 2>/dev/null)"
  [ -n "$tok" ] || { echo "the SSO gives no token: $(head -c 200 <<<"$body")" >&2; return 1; }
  printf '%s' "$tok"
}

# oauth_client <user>: "<client_id> <client_secret>" of an OAuth client of the user's instance (start.sh's for alice,
# registered once for the others, POST /auth/register)
oauth_client() {
  local user="$1" file="$STATE_DIR/client.$1" body
  if [ "$user" = "$CHAOS_USER" ]; then printf '%s %s' "$CHAOS_CLIENT_ID" "$CHAOS_CLIENT_SECRET"; return 0; fi
  if [ -s "$file" ]; then cat "$file"; return 0; fi
  body="$(curl -s -m "$(ct)" -H "Host: $(instance_of "$user")" -H 'Content-Type: application/json' -H 'Accept: application/json' \
    -d '{"redirect_uris":["http://localhost/chaos"],"client_name":"twake-chaos","software_id":"github.com/linagora/twake-chaos"}' \
    "$CHAOS_STACK_URL/auth/register")" || { echo "cannot register an OAuth client" >&2; return 1; }
  jq -er '.client_id + " " + .client_secret' <<<"$body" >"$file.$$" 2>/dev/null \
    || { rm -f "$file.$$"; echo "cannot register an OAuth client: $(head -c 200 <<<"$body")" >&2; return 1; }
  mv -f "$file.$$" "$file"
  cat "$file"
}

# instance_token <user> <sso token>: the SSO token exchanged for a token of the instance (POST /oidc/access_token)
instance_token() {
  local user="$1" sso="$2" id secret body tok
  read -r id secret <<<"$(oauth_client "$user")" || return 1
  [ -n "$secret" ] || return 1
  body="$(curl -s -m "$(ct)" -H "Host: $(instance_of "$user")" -H 'Content-Type: application/json' -H 'Accept: application/json' \
    -d "$(jq -nc --arg i "$id" --arg s "$secret" --arg sc "$SCOPE" --arg t "$sso" '{client_id:$i, client_secret:$s, scope:$sc, oidc_token:$t}')" \
    "$CHAOS_STACK_URL/oidc/access_token")" || { echo "the instance does not answer /oidc/access_token" >&2; return 1; }
  tok="$(jq -r '.access_token // empty' <<<"$body" 2>/dev/null)"
  [ -n "$tok" ] || { echo "the instance does not exchange the SSO token: $(head -c 200 <<<"$body")" >&2; return 1; }
  printf '%s' "$tok"
}

# token <user>: the token the client holds (7 days); a new one through the SSO when none is held or it was refused
token() {
  local file="$STATE_DIR/token.$1" sso tok
  if [ -s "$file" ]; then cat "$file"; return 0; fi
  sso="$(sso_token "$1")" || return 1
  tok="$(instance_token "$1" "$sso")" || return 1
  printf '%s' "$tok" >"$file.$$" && mv -f "$file.$$" "$file"
  printf '%s' "$tok"
}
forget_token() { rm -f "$STATE_DIR/token.$1"; }

# ---------------------------------------------------------------------------------------------------- the API
# api <user> <method> <path> [curl args...]: sets CODE (000 on a timeout / connection error) and BODY. A 401 makes the
# held token be forgotten and the call made once more with a new one.
CODE="" BODY=""
api() {
  local user="$1" method="$2" path="$3" tok try
  shift 3
  for try in 1 2; do
    tok="$(token "$user")" || { CODE=000; BODY="no token for $user: $(token "$user" 2>&1 >/dev/null)"; return 1; }
    rm -f "$WORK/body"
    CODE="$(curl -s -m "$(ct)" -o "$WORK/body" -w '%{http_code}' -X "$method" -H "Host: $(instance_of "$user")" \
      -H "Authorization: Bearer $tok" -H 'Accept: application/vnd.api+json' "$@" "$CHAOS_STACK_URL$path")"
    BODY="$(cat "$WORK/body" 2>/dev/null)"
    [ "$CODE" = 401 ] && [ $try = 1 ] && { forget_token "$user"; continue; }
    break
  done
  [ "${CODE:0:1}" = 2 ]
}
# why <what>: "<what>: HTTP <code> <start of the body>" of the last call
why() { echo "$1: HTTP ${CODE/#000/timeout or no connection} $(head -c 200 <<<"$BODY")"; }

# upload <user> <dir id> <name> <file> <content type>: the id of the new file (POST /files/:dir-id?Type=file)
upload() {
  api "$1" POST "/files/$2?Type=file&Name=$(jq -rn --arg n "$3" '$n|@uri')" -H "Content-Type: $5" --data-binary "@$4" \
    || { why "upload of $3" >&2; return 1; }
  jq -er '.data.id' <<<"$BODY"
}
# make_dir <user> <parent id> <name>: the id of the new folder
make_dir() {
  api "$1" POST "/files/$2?Type=directory&Name=$(jq -rn --arg n "$3" '$n|@uri')" || { why "creation of the folder $3" >&2; return 1; }
  jq -er '.data.id' <<<"$BODY"
}
# destroy <user> <id>: in the trash then out of it (best effort, cleaning)
destroy() {
  api "$1" DELETE "/files/$2" >/dev/null 2>&1
  api "$1" DELETE "/files/trash/$2" >/dev/null 2>&1
  return 0
}
cleanup_file() { cleanup destroy "$1" "$2"; }

# work_dir <user>: the id of the folder where the probes create their files (/chaos-control, created once)
work_dir() {
  local file="$STATE_DIR/workdir.$1" id
  if [ -s "$file" ]; then cat "$file"; return 0; fi
  if api "$1" GET "/files/metadata?Path=/chaos-control"; then
    id="$(jq -r '.data.id' <<<"$BODY")"
  elif [ "$CODE" = 404 ]; then
    id="$(make_dir "$1" io.cozy.files.root-dir chaos-control 2>/dev/null)" \
      || { api "$1" GET "/files/metadata?Path=/chaos-control" && id="$(jq -r '.data.id' <<<"$BODY")"; } \
      || { why "the folder /chaos-control" >&2; return 1; }
  else
    why "the folder /chaos-control" >&2; return 1
  fi
  printf '%s' "$id" >"$STATE_DIR/workdir.$1"
  printf '%s' "$id"
}

# ---------------------------------------------------------------------------------------------------- fixtures
# A fixture: a file kept between runs for the probes that only read one (made while the stack is healthy). Its id in
# $STATE_DIR/fixture.<name>; made again when it is gone.
# ensure_fixture <name> <file name> <generator command> <content type>: its id
ensure_fixture() {
  local name="$1" fname="$2" gen="$3" type="$4" file="$STATE_DIR/fixture.$1" id dir
  if [ -s "$file" ]; then
    id="$(cat "$file")"
    if api "$CHAOS_USER" GET "/files/$id" && [ "$(jq -r '.data.attributes.trashed' <<<"$BODY")" = false ]; then
      printf '%s' "$id"; return 0
    fi
    [ "$CODE" = 404 ] || [ "${CODE:0:1}" = 2 ] || { why "the fixture $name" >&2; return 1; }
  fi
  dir="$(work_dir "$CHAOS_USER")" || return 1
  eval "$gen \"\$WORK/fixture.$name\"" || { echo "cannot generate the fixture $name" >&2; return 1; }
  id="$(upload "$CHAOS_USER" "$dir" "fixture-$name-$TOKEN_ID-$fname" "$WORK/fixture.$name" "$type")" || return 1
  printf '%s' "$id" >"$file"
  printf '%s' "$id"
}

# ensure_dir_fixture <name>: the id of a folder of /chaos-control kept between runs
ensure_dir_fixture() {
  local file="$STATE_DIR/fixture.dir-$1" id dir
  if [ -s "$file" ]; then
    id="$(cat "$file")"
    if api "$CHAOS_USER" GET "/files/$id" && [ "$(jq -r '.data.attributes.dir_id' <<<"$BODY")" != io.cozy.files.trash-dir ]; then
      printf '%s' "$id"; return 0
    fi
    [ "$CODE" = 404 ] || [ "${CODE:0:1}" = 2 ] || { why "the fixture folder $1" >&2; return 1; }
  fi
  dir="$(work_dir "$CHAOS_USER")" || return 1
  id="$(make_dir "$CHAOS_USER" "$dir" "fixture-$1-$TOKEN_ID")" || return 1
  printf '%s' "$id" >"$file"
  printf '%s' "$id"
}

# ---------------------------------------------------------------------------------------------------- web session
# web_login <user>: signs in on the login page (the passphrase hashed as login.js does), prints the session cookie
web_login() {
  local host page csrf salt iter hash cookie code
  host="$(instance_of "$1")"
  page="$(curl -s -m "$(ct)" -D "$WORK/login.h" -H "Host: $host" "$CHAOS_STACK_URL/auth/login")" \
    || { echo "the login page does not answer" >&2; return 1; }
  csrf="$(sed -n 's/.*name="csrf_token" value="\([^"]*\)".*/\1/p' <<<"$page" | head -1)"
  salt="$(sed -n 's/.*data-salt="\([^"]*\)".*/\1/p' <<<"$page" | head -1)"
  iter="$(sed -n 's/.*data-iterations="\([0-9]*\)".*/\1/p' <<<"$page" | head -1)"
  cookie="$(sed -n 's/^[Ss]et-[Cc]ookie: \(_csrf=[^;]*\).*/\1/p' "$WORK/login.h" | head -1)"
  [ -n "$csrf" ] && [ -n "$salt" ] && [ -n "$cookie" ] || { echo "the login page has no form: $(head -c 200 <<<"$page")" >&2; return 1; }
  if [ "${iter:-0}" -gt 0 ]; then hash="$(py passhash "$CHAOS_PASSWORD" "$salt" "$iter")"; else hash="$CHAOS_PASSWORD"; fi
  code="$(curl -s -m "$(ct)" -o "$WORK/login.b" -D "$WORK/login2.h" -w '%{http_code}' -H "Host: $host" -H "Cookie: $cookie" \
    -H 'Accept: application/json' --data-urlencode "csrf_token=$csrf" --data-urlencode "passphrase=$hash" \
    -d long-run-session=1 "$CHAOS_STACK_URL/auth/login")"
  [ "$code" = 200 ] || { echo "login: HTTP $code $(head -c 200 "$WORK/login.b")" >&2; return 1; }
  # the session cookie: cozysessid, sess-<db prefix> with flat subdomains (model/session CookieName)
  cookie="$(sed -n 's/^[Ss]et-[Cc]ookie: \(\(cozysessid\|sess-[^=]*\)=[^;]*\).*/\1/p' "$WORK/login2.h" | head -1)"
  [ -n "$cookie" ] || { echo "login: no session cookie ($(grep -i '^set-cookie' "$WORK/login2.h" | cut -d= -f1 | tr '\n' ' '))" >&2; return 1; }
  printf '%s' "$cookie"
}
# session <user>: the session cookie the browser holds; a new sign-in when none is held
session() {
  local file="$STATE_DIR/session.$1" c
  if [ -s "$file" ]; then cat "$file"; return 0; fi
  c="$(web_login "$1")" || return 1
  printf '%s' "$c" >"$file.$$" && mv -f "$file.$$" "$file"
  printf '%s' "$c"
}
forget_session() { rm -f "$STATE_DIR/session.$1"; }
