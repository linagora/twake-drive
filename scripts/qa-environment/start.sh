#!/bin/bash
#
# Starts a long lived Cozy Stack + CouchDB + OnlyOffice stack with Drive installed, for manual or
# agent driven exploratory QA.
#
# The stack of the e2e suite (docker-compose.e2e.yml, provisioned by e2e/setup/global-setup.ts)
# with the build of build.sh, under its own compose project and fixed ports, kept up until stop.sh
# is called, and with some files in the accounts (setup.js). Each start recreates it from scratch.
#
#   scripts/qa-environment/build.sh    # once, and whenever the code under test changes
#   scripts/qa-environment/start.sh
#
# Accounts (instance / password): alice.cozy.localhost / alice1234, bob.cozy.localhost / bob1234,
# charlie.cozy.localhost / charlie1234, members of one organisation (sharings are auto-accepted).
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

QA_PROJECT="${QA_PROJECT:-twake-drive-qa}"
# Published on 127.0.0.1 only, away from the ports of the e2e suite (18080...) and the dev stack
# (19080...). The stack and the OnlyOffice proxy listen on the same ports inside the network.
QA_STACK_PORT="${QA_STACK_PORT:-18700}"
QA_ADMIN_PORT="${QA_ADMIN_PORT:-18701}"
QA_COUCHDB_PORT="${QA_COUCHDB_PORT:-18702}"
QA_ONLYOFFICE_PORT="${QA_ONLYOFFICE_PORT:-18703}"
ROOT_DOMAIN="cozy.localhost"

if [ ! -f "$REPO_DIR/build/manifest.webapp" ]; then
  echo "The build of Drive is missing, build it first: scripts/qa-environment/build.sh" >&2
  exit 1
fi

# toolbox.sh forwards every E2E_* variable, and either of these would make the e2e setup keep the old stack
unset E2E_PERSIST E2E_SKIP_TEARDOWN

echo "==> Starting the stack as compose project '$QA_PROJECT'"
E2E_PROJECT_NAME="$QA_PROJECT" \
  COZY_E2E_ROOT_DOMAIN="$ROOT_DOMAIN" \
  COZY_E2E_STACK_PORT="$QA_STACK_PORT" \
  COZY_E2E_ADMIN_PORT="$QA_ADMIN_PORT" \
  COZY_E2E_COUCHDB_PORT="$QA_COUCHDB_PORT" \
  COZY_E2E_ONLYOFFICE_PORT="$QA_ONLYOFFICE_PORT" \
  E2E_AUTH_STATE_PATH=/tmp/auth-state.json \
  TOOLBOX_DOCKER=1 \
  "$SCRIPT_DIR/toolbox.sh" node scripts/qa-environment/setup.js

cat <<INFO

==> The QA environment is up

  Drive:    http://alice-drive.$ROOT_DOMAIN:$QA_STACK_PORT/  (bob-drive, charlie-drive)
  Login:    http://alice.$ROOT_DOMAIN:$QA_STACK_PORT/auth/login  (alice1234, bob1234, charlie1234)
  Office:   http://onlyoffice.$ROOT_DOMAIN:$QA_ONLYOFFICE_PORT
  Admin:    http://127.0.0.1:$QA_ADMIN_PORT  (admin / cozy)

From a container (e.g. Playwright), share the network of the stack, whose DNS resolves
*.$ROOT_DOMAIN to it, and use the URLs above:
  docker run --network container:${QA_PROJECT}-coredns-1 ...

Stop it with: scripts/qa-environment/stop.sh
INFO
