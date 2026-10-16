#!/bin/bash
#
# Builds the production bundle of Drive (build/) that start.sh installs in the instances, from the
# working tree. The backend images are pulled by start.sh.
#
#   scripts/qa-environment/build.sh    # once, and whenever the code under test changes
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

docker build -q -f "$SCRIPT_DIR/toolbox.Dockerfile" -t twake-drive-qa-toolbox "$SCRIPT_DIR" >/dev/null

"$SCRIPT_DIR/toolbox.sh" corepack yarn install --immutable
"$SCRIPT_DIR/toolbox.sh" corepack yarn build
