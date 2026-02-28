#!/usr/bin/env bash
#
# oo-dev-setup.sh - Start OnlyOffice Document Server with Scribe plugin mounted
#
# Usage: Run from the repository root:
#   ./scripts/oo-dev-setup.sh
#
# This script:
#   1. Starts the OO Document Server in Docker with the Scribe plugin volume-mounted
#   2. Waits for the server to be ready
#   3. Prints the OO Document Server version
#   4. Registers the plugin
#   5. Prints instructions for next steps

set -euo pipefail

CONTAINER_NAME="oo-dev"
PLUGIN_HOST_PATH="$(cd "$(dirname "$0")/.." && pwd)/plugins/onlyoffice-scribe"
PLUGIN_CONTAINER_PATH="/var/www/onlyoffice/documentserver/sdkjs-plugins/scribe"
OO_IMAGE="onlyoffice/documentserver"

echo "=== OnlyOffice Document Server - Scribe Dev Setup ==="
echo ""

# Check if container already exists
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  echo "Container '${CONTAINER_NAME}' already exists."
  if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "Container is running. To restart: docker restart ${CONTAINER_NAME}"
    echo "To remove and recreate: docker rm -f ${CONTAINER_NAME} && ./scripts/oo-dev-setup.sh"
  else
    echo "Container is stopped. Starting it..."
    docker start "${CONTAINER_NAME}"
  fi
  echo ""
else
  echo "Starting OnlyOffice Document Server..."
  echo "  Image: ${OO_IMAGE}"
  echo "  Container: ${CONTAINER_NAME}"
  echo "  Plugin mount: ${PLUGIN_HOST_PATH} -> ${PLUGIN_CONTAINER_PATH}"
  echo ""

  docker run -itd \
    -p 80:80 \
    --name "${CONTAINER_NAME}" \
    -e JWT_ENABLED=false \
    -e DS_EXAMPLE_ENABLE=true \
    -e ALLOW_PRIVATE_IP_ADDRESS=true \
    -v "${PLUGIN_HOST_PATH}:${PLUGIN_CONTAINER_PATH}" \
    "${OO_IMAGE}"

  echo "Container started."
fi

echo ""
echo "Waiting for OnlyOffice Document Server to be ready..."
echo "(This may take 1-2 minutes on first start)"

# Wait for the server to respond (up to 120 seconds)
TIMEOUT=120
ELAPSED=0
while [ $ELAPSED -lt $TIMEOUT ]; do
  if curl -s -o /dev/null -w "%{http_code}" http://localhost 2>/dev/null | grep -q "200\|302"; then
    echo "Server is ready."
    break
  fi
  sleep 5
  ELAPSED=$((ELAPSED + 5))
  echo "  Still waiting... (${ELAPSED}s)"
done

if [ $ELAPSED -ge $TIMEOUT ]; then
  echo "WARNING: Server did not respond within ${TIMEOUT}s."
  echo "Check logs with: docker logs ${CONTAINER_NAME}"
  echo "The server may still be starting up. Wait a bit and try http://localhost"
fi

echo ""
echo "=== OO Document Server Version ==="
docker exec "${CONTAINER_NAME}" dpkg -l onlyoffice-documentserver 2>/dev/null \
  | grep onlyoffice-documentserver \
  || echo "Could not determine version. Container may still be initializing."

echo ""
echo "=== Starting Example Service ==="
docker exec "${CONTAINER_NAME}" supervisorctl start ds:example 2>/dev/null \
  && echo "Example service started." \
  || echo "Could not start example service. Try: docker exec ${CONTAINER_NAME} supervisorctl start ds:example"

echo ""
echo "=== Registering Scribe Plugin ==="
docker exec "${CONTAINER_NAME}" bash -c \
  '/usr/bin/documentserver-pluginsmanager.sh --directory="/var/www/onlyoffice/documentserver/sdkjs-plugins" --update="/var/www/onlyoffice/documentserver/sdkjs-plugins/plugin-list-default.json"' \
  2>/dev/null \
  || echo "Plugin registration command failed. The plugin may still load -- try opening a document."

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "  1. Open http://localhost in your browser"
echo "  2. Create a new document or upload a .docx file"
echo "  3. Open browser DevTools console (F12)"
echo "  4. Look for '[Scribe] Plugin loaded' message"
echo ""
echo "Dev iteration:"
echo "  - Edit files in plugins/onlyoffice-scribe/"
echo "  - Hard refresh browser (Ctrl+Shift+R)"
echo "  - Check console for [Scribe] messages"
echo ""
echo "Alternative plugin loading (if volume mount doesn't register):"
echo "  1. In another terminal: cd plugins/onlyoffice-scribe && npx http-server -p 3500 --cors"
echo "  2. In browser DevTools, select 'frameEditor' in console scope"
echo "  3. Run: Asc.editor.installDeveloperPlugin('http://localhost:3500/config.json')"
echo ""
echo "Useful commands:"
echo "  docker logs ${CONTAINER_NAME}          # View server logs"
echo "  docker restart ${CONTAINER_NAME}       # Restart server"
echo "  docker rm -f ${CONTAINER_NAME}         # Remove container"
