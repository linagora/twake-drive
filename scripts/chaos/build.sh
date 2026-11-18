#!/bin/bash
#
# Builds the image of the application from the commit under test: the bundle of Drive, as
# scripts/qa-environment/build.sh builds it (yarn install and yarn build in the repository's toolbox image), put in
# /opt/drive of a cozy-stack image (conf/stack/Dockerfile). That cozy-stack: COZY_STACK_IMAGE (default: the one of
# docker-compose.e2e.yml), or built from a cozy-stack checkout with its production Dockerfile when COZY_STACK_DIR is set.
# Then pulls the images of the stack. DRIVE_IMAGE given (a published image with the same layout): no build, it is pulled.
#
set -euo pipefail
. "$(dirname "$0")/common.sh"

if [ "$DRIVE_IMAGE" != "$BUILT_IMAGE" ]; then
  echo "==> Using $DRIVE_IMAGE (DRIVE_IMAGE): no build"
  docker image inspect "$DRIVE_IMAGE" >/dev/null 2>&1 || docker pull --quiet "$DRIVE_IMAGE"
else
  echo "==> The bundle of Drive (scripts/qa-environment/build.sh of $REPO_DIR)"
  bash "$REPO_DIR/scripts/qa-environment/build.sh"
  [ -f "$REPO_DIR/build/manifest.webapp" ] || { echo "no build/manifest.webapp after the build of Drive" >&2; exit 1; }

  if [ -n "${COZY_STACK_DIR:-}" ]; then
    COZY_STACK_IMAGE="$CHAOS_PROJECT-cozy-stack:latest"
    echo "==> cozy-stack, built from $COZY_STACK_DIR ($(git -C "$COZY_STACK_DIR" rev-parse --short HEAD 2>/dev/null || echo '?'))"
    docker build -q -t "$COZY_STACK_IMAGE" -f "$COZY_STACK_DIR/scripts/docker/production/Dockerfile" \
      --build-arg VERSION_STRING="chaos-$(git -C "$COZY_STACK_DIR" rev-parse --short HEAD 2>/dev/null || echo build)" \
      "$COZY_STACK_DIR" >/dev/null
  else
    echo "==> cozy-stack: $COZY_STACK_IMAGE"
    docker pull --quiet "$COZY_STACK_IMAGE" >/dev/null
  fi

  echo "==> The image of the application: $BUILT_IMAGE"
  docker build -q -t "$BUILT_IMAGE" --build-arg COZY_STACK_IMAGE="$COZY_STACK_IMAGE" \
    -f "$CHAOS_DIR/conf/stack/Dockerfile" "$REPO_DIR/build" >/dev/null
fi

echo "==> Pulling the other images"
compose pull --quiet --ignore-pull-failures $(compose config --services | grep -vx stack)
