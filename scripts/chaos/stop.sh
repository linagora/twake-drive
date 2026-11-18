#!/bin/bash
set -euo pipefail
. "$(dirname "$0")/common.sh"
compose down -v --remove-orphans
