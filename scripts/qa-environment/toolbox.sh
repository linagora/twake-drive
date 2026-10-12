#!/bin/bash
#
# Runs a command in the toolbox image (Node 24, Yarn of package.json, Docker CLI) from the root of
# the repository, as the current user, on the host network.
#
#   scripts/qa-environment/toolbox.sh corepack yarn build
#   TOOLBOX_DOCKER=1 scripts/qa-environment/toolbox.sh node scripts/qa-environment/setup.js
#
# The Docker socket of the host is only mounted with TOOLBOX_DOCKER=1, for the steps that drive the
# compose stack: it gives full control of the host, which yarn install and the dependency scripts of
# the build must not get.
#
# The repository is mounted at its own path: compose resolves the bind mounts of
# docker-compose.e2e.yml (./build, ./e2e/cozy.yml...) against the host. Yarn keeps its cache and
# corepack its Yarn under .yarn/, next to node_modules.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
TOOLBOX_IMAGE="twake-drive-qa-toolbox"
ROOT_DOMAIN="${COZY_E2E_ROOT_DOMAIN:-cozy.localhost}"

hosts=()
for name in alice bob charlie; do
  hosts+=(--add-host "$name.$ROOT_DOMAIN:127.0.0.1" --add-host "$name-drive.$ROOT_DOMAIN:127.0.0.1")
done
hosts+=(--add-host "onlyoffice.$ROOT_DOMAIN:127.0.0.1")

docker_access=()
if [ "${TOOLBOX_DOCKER:-}" = 1 ]; then
  docker_access=(--group-add "$(stat -c %g /var/run/docker.sock)" -v /var/run/docker.sock:/var/run/docker.sock)
fi

envs=()
for name in $(compgen -e); do
  case "$name" in
    E2E_* | COZY_E2E_*) envs+=(-e "$name") ;;
  esac
done

exec docker run --rm --network host "${hosts[@]}" \
  -u "$(id -u):$(id -g)" "${docker_access[@]}" \
  -v "$REPO_DIR:$REPO_DIR" -w "$REPO_DIR" \
  -e HOME=/tmp \
  -e COREPACK_HOME="$REPO_DIR/.yarn/corepack" \
  -e COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
  -e YARN_ENABLE_GLOBAL_CACHE=false \
  "${envs[@]}" \
  "$TOOLBOX_IMAGE" "$@"
