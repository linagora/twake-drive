#!/bin/bash
set -euo pipefail
. "$(dirname "$0")/common.sh"
compose down -v --remove-orphans
# what the control scripts kept (OAuth clients, tokens, sessions, fixtures) was of the instances removed
rm -rf "$CHAOS_RUN/control"
