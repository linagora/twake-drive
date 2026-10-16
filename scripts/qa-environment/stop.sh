#!/bin/bash
#
# Stops the QA environment started by start.sh and drops its data: the Stack keeps the files
# inside its container, CouchDB in a volume of the compose project.
#
#   scripts/qa-environment/stop.sh
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
QA_PROJECT="${QA_PROJECT:-twake-drive-qa}"

docker compose -f "$REPO_DIR/docker-compose.e2e.yml" --project-name "$QA_PROJECT" \
  down --volumes --remove-orphans
echo "==> QA environment '$QA_PROJECT' stopped"
