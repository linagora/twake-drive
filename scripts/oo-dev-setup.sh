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

  # Detect Docker gateway IP for host access from container
  # --add-host is required because .localhost domains are resolved to 127.0.0.1
  # by libcurl/Node.js per RFC 6761, ignoring /etc/hosts entries.
  GATEWAY_IP="172.17.0.1"

  docker run -itd \
    -p 80:80 \
    --name "${CONTAINER_NAME}" \
    --add-host alice.localhost:"${GATEWAY_IP}" \
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
echo "=== Configuring JWT ==="
# OO 9.x validates JWT even when token.enable flags are false (checkJwt runs
# regardless). The secret must match the one in cozy-stack's cozy.yml.
# We also disable token.enable flags to avoid additional validation checks
# (callbackUrl requirement, payload mismatch with editorConfig).
OO_SECRET="1Ji0VcWaWi7CPslwPtYLDf9yDDkNcF62"
docker exec "${CONTAINER_NAME}" python3 -c "
import json
SECRET = '${OO_SECRET}'
with open('/etc/onlyoffice/documentserver/local.json') as f:
    d = json.load(f)
d['services']['CoAuthoring']['token']['enable']['browser'] = False
d['services']['CoAuthoring']['token']['enable']['request']['inbox'] = False
# outbox must stay True so OO signs callbacks to cozy-stack
d['services']['CoAuthoring']['token']['enable']['request']['outbox'] = True
d['services']['CoAuthoring']['secret']['inbox']['string'] = SECRET
d['services']['CoAuthoring']['secret']['outbox']['string'] = SECRET
d['services']['CoAuthoring']['secret']['session']['string'] = SECRET
d['services']['CoAuthoring']['secret']['browser']['string'] = SECRET
with open('/etc/onlyoffice/documentserver/local.json', 'w') as f:
    json.dump(d, f, indent=2)
" 2>/dev/null && echo "JWT configured (secret: ${OO_SECRET:0:8}...)." \
  || echo "WARNING: Could not configure JWT. You may see 'security token' errors."

echo ""
echo "=== Restarting Document Service ==="
# Restart docservice to pick up the JWT config change.
docker exec "${CONTAINER_NAME}" supervisorctl restart ds:docservice 2>/dev/null \
  && echo "Document service restarted." \
  || echo "WARNING: Could not restart docservice."
sleep 3

echo ""
echo "=== Starting Example Service ==="
docker exec "${CONTAINER_NAME}" supervisorctl start ds:example 2>/dev/null \
  && echo "Example service started." \
  || echo "Could not start example service. Try: docker exec ${CONTAINER_NAME} supervisorctl start ds:example"

echo ""
echo "=== Fixing Plugin File Ownership ==="
# Docker changes ownership of mounted files to container's internal user.
# Fix it so the host user can edit plugin files without sudo.
docker exec "${CONTAINER_NAME}" chown -R "$(id -u):$(id -g)" "${PLUGIN_CONTAINER_PATH}" 2>/dev/null \
  && echo "File ownership fixed." \
  || echo "Could not fix ownership. Run: sudo chown -R \$(whoami):\$(whoami) plugins/onlyoffice-scribe/"
# Remove .gz files created by OO (may contain stale cached versions)
rm -f "${PLUGIN_HOST_PATH}"/*.gz "${PLUGIN_HOST_PATH}"/scripts/*.gz 2>/dev/null

echo ""
echo "=== Registering Scribe Plugin ==="
docker exec "${CONTAINER_NAME}" bash -c \
  '/usr/bin/documentserver-pluginsmanager.sh --directory="/var/www/onlyoffice/documentserver/sdkjs-plugins" --update="/var/www/onlyoffice/documentserver/sdkjs-plugins/plugin-list-default.json"' \
  2>/dev/null \
  || echo "Plugin registration command failed. The plugin may still load -- try opening a document."

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Cozy stack setup (required for Scribe testing via Cozy Drive):"
echo ""
echo "  1. Ensure ~/.cozy/cozy.yml has:"
echo "       host: 0.0.0.0"
echo "       office:"
echo "         default:"
echo "           onlyoffice_url: http://localhost"
echo "           onlyoffice_inbox_secret: <secret from: docker exec ${CONTAINER_NAME} python3 -c \"import json; print(json.load(open('/etc/onlyoffice/documentserver/local.json'))['services']['CoAuthoring']['secret']['inbox']['string'])\">"
echo "           onlyoffice_outbox_secret: <same secret>"
echo ""
echo "  2. Start the stack:"
echo "       cozy-stack serve --appdir drive:./build/ --disable-csp"
echo ""
echo "  3. Open http://alice.localhost:8080/ and open a .docx file"
echo ""
echo "Quick test (OO only, no Cozy stack):"
echo "  1. Open http://localhost/example/ in your browser"
echo "  2. Create a new document"
echo "  3. Open DevTools console (F12)"
echo "  4. Look for '[Scribe] Plugin loaded' message"
echo ""
echo "Dev iteration:"
echo "  - Edit files in plugins/onlyoffice-scribe/"
echo "  - Hard refresh browser (Ctrl+Shift+R)"
echo "  - Check console for [Scribe] messages"
echo ""
echo "Useful commands:"
echo "  docker logs ${CONTAINER_NAME}          # View server logs"
echo "  docker restart ${CONTAINER_NAME}       # Restart server"
echo "  docker rm -f ${CONTAINER_NAME}         # Remove container"
