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
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_HOST_PATH="$(cd "$(dirname "$0")/.." && pwd)/plugins/onlyoffice-scribe"
PLUGIN_CONTAINER_PATH="/var/www/onlyoffice/documentserver/sdkjs-plugins/scribe"
# OO 9.4.0.1 == documentserver build 9.4.0-129 (matches sdkjs patch tag v9.4.0.129).
# Override with OO_IMAGE=... to pin a different build.
OO_IMAGE="${OO_IMAGE:-onlyoffice/documentserver:9.4.0.1}"

echo "=== OnlyOffice Document Server - Scribe Dev Setup ==="
echo ""

# Check if container already exists
NEED_WAIT=false
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  echo "Container '${CONTAINER_NAME}' already exists."
  if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "Container is running."
  else
    echo "Container is stopped. Starting it..."
    docker start "${CONTAINER_NAME}"
    NEED_WAIT=true
  fi
  echo ""
else
  echo "Starting OnlyOffice Document Server..."
  echo "  Image: ${OO_IMAGE}"
  echo "  Container: ${CONTAINER_NAME}"
  echo "  Plugin mount: ${PLUGIN_HOST_PATH} -> ${PLUGIN_CONTAINER_PATH}"
  echo ""

  # Use --network=host so the container shares the host's network stack.
  # This way ALL *.localhost subdomains (alice.localhost, alice2.localhost, etc.)
  # resolve correctly without needing --add-host entries for each one.

  # Patched SDK (OO 9.4): mount ONLY sdk-all.js with the GetInlineDrawings patch.
  # On 9.4 apiBuilder.js (the builder API + our patch) lives only in sdk-all.js,
  # not sdk-all-min.js; sdk-all.js has no .gz in the image so the bind mount is
  # served directly. Built from sdkjs v9.4.0.129 + the patch + the sdkjs-forms
  # addon (see ~/Dev-local/onlyoffice-sdkjs-94 and plugins/onlyoffice-scribe/oo-api-proposal.md).
  SDKJS_PATCHED_94="$(cd "$(dirname "$0")/.." && pwd)/../onlyoffice-sdkjs-94/dist/sdkjs-patch-9.4.0.129/sdk-all.js"
  SDKJS_CONTAINER_DIR="/var/www/onlyoffice/documentserver/sdkjs/word"
  SDKJS_VOLUMES=""
  if [ -f "${SDKJS_PATCHED_94}" ]; then
    echo "  Patched SDK (9.4): mounting sdk-all.js (GetInlineDrawings)"
    SDKJS_VOLUMES="-v ${SDKJS_PATCHED_94}:${SDKJS_CONTAINER_DIR}/sdk-all.js:ro"
  else
    echo "  WARNING: 9.4 patched sdk-all.js not found at ${SDKJS_PATCHED_94}"
    echo "           Starting WITHOUT the SDK patch — inline-image extraction will fall back."
  fi

  docker run -itd \
    --network=host \
    --name "${CONTAINER_NAME}" \
    -e JWT_ENABLED=false \
    -e DS_EXAMPLE_ENABLE=true \
    -e ALLOW_PRIVATE_IP_ADDRESS=true \
    -v "${PLUGIN_HOST_PATH}:${PLUGIN_CONTAINER_PATH}" \
    ${SDKJS_VOLUMES} \
    "${OO_IMAGE}"

  echo "Container started."
  NEED_WAIT=true
fi

if [ "$NEED_WAIT" = "false" ]; then
  # Container was already running — skip wait, jump straight to JWT config
  echo "Skipping wait (container already running)."
  echo ""
else
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
echo "=== Registering Scribe Plugin ==="
docker exec "${CONTAINER_NAME}" bash -c \
  '/usr/bin/documentserver-pluginsmanager.sh --directory="/var/www/onlyoffice/documentserver/sdkjs-plugins" --update="/var/www/onlyoffice/documentserver/sdkjs-plugins/plugin-list-default.json"' \
  2>/dev/null \
  || echo "Plugin registration command failed. The plugin may still load -- try opening a document."

echo ""
echo "=== Fixing Plugin File Ownership ==="
# Docker/OO changes ownership of mounted files to container's internal user.
# Fix ownership AND permissions so the host user can always edit plugin files.
# Runs AFTER plugin registration since OO may create/modify files during registration.
docker exec "${CONTAINER_NAME}" bash -c "chown -R $(id -u):$(id -g) '${PLUGIN_CONTAINER_PATH}' && chmod -R a+rw '${PLUGIN_CONTAINER_PATH}'" 2>/dev/null \
  && echo "File ownership and permissions fixed." \
  || echo "Could not fix permissions. Run: sudo chown -R \$(whoami):\$(whoami) plugins/onlyoffice-scribe/"
# Remove .gz files created by OO (may contain stale cached versions)
rm -f "${PLUGIN_HOST_PATH}"/*.gz "${PLUGIN_HOST_PATH}"/scripts/*.gz 2>/dev/null

echo ""
echo "=== Disabling service-worker caching of plugin assets ==="
# OO's editor service worker caches sdkjs-plugins with a CACHE-FIRST strategy in
# the Cache API, which serves a stale code.js even when nginx says no-store (the
# SW intercepts the fetch before it reaches the network). Drop "sdkjs-plugins/"
# from its cacheable prefixes so plugin requests always go to the network; every
# other asset (web-apps/sdkjs/fonts) stays SW-cached for speed. Idempotent and
# re-applied every run — the SW file is static in the image, so a fresh container
# ships it pristine (with sdkjs-plugins) and this re-patches it.
SW_FILE="/var/www/onlyoffice/documentserver/sdkjs/common/serviceworker/document_editor_service_worker.js"
if docker exec "${CONTAINER_NAME}" sh -c '
      SW="'"${SW_FILE}"'"
      [ -f "$SW" ] || exit 1
      if grep -q "\"sdkjs-plugins/\"," "$SW"; then
        sed -i "/^[[:space:]]*\"sdkjs-plugins\/\",[[:space:]]*\$/d" "$SW"
      fi
      ! grep -q "\"sdkjs-plugins/\"," "$SW"   # confirm it is gone
    ' 2>/dev/null; then
  echo "Service worker no longer caches sdkjs-plugins (plugin edits reach the network)."
else
  echo "WARNING: could not patch the editor service worker — a browser 'Clear site data' may be needed to drop old plugin code.js."
fi

echo ""
echo "=== Applying plugin no-cache nginx override ==="
# Make plugin assets always revalidate so a plain browser hard-refresh (Ctrl+Shift+R)
# picks up code.js edits — no fresh browser context needed. Re-applied on EVERY run
# because the fix lives in the image's static ds-docservice.conf: a `docker start`
# keeps it, but `docker rm` + `docker run` (fresh container) resets it to immutable.
# Idempotent via the OO-DEV-CACHE-FIX BEGIN/END markers.
DS_CONF="/etc/onlyoffice/documentserver/nginx/includes/ds-docservice.conf"
NOCACHE_SNIPPET="${SCRIPT_DIR}/oo-dev-plugins-nocache.nginx"
if [ -f "${NOCACHE_SNIPPET}" ] \
   && docker cp "${NOCACHE_SNIPPET}" "${CONTAINER_NAME}:/tmp/oo-dev-plugins-nocache.nginx" 2>/dev/null \
   && docker exec "${CONTAINER_NAME}" sh -c '
        CONF="'"${DS_CONF}"'"
        [ -f "$CONF" ] || exit 1
        cp "$CONF" "$CONF.bak"
        # drop any previous managed block, then prepend a fresh one (first-match wins)
        sed -i "/# OO-DEV-CACHE-FIX BEGIN/,/# OO-DEV-CACHE-FIX END/d" "$CONF"
        cat /tmp/oo-dev-plugins-nocache.nginx "$CONF" > "$CONF.new" && mv "$CONF.new" "$CONF"
        if nginx -t >/dev/null 2>&1; then
          nginx -s reload >/dev/null 2>&1; rm -f "$CONF.bak"
        else
          mv "$CONF.bak" "$CONF"; exit 1   # rollback a broken config, never leave it live
        fi
      ' 2>/dev/null; then
  echo "Plugins served no-store (hard refresh picks up code.js); nginx reloaded."
else
  echo "WARNING: could not apply plugin no-cache override — a hard refresh may serve a stale plugin."
  echo "  Fallback: open the editor in a fresh browser context/incognito to load new code.js."
fi

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
echo "  ./scripts/oo-dev-setup.sh             # Restart (re-applies JWT config)"
echo "  docker rm -f ${CONTAINER_NAME}         # Remove container"
echo ""
echo "WARNING: Do NOT use 'docker restart ${CONTAINER_NAME}' directly."
echo "  OO regenerates its JWT config on restart, breaking Cozy Stack auth."
echo "  Always use ./scripts/oo-dev-setup.sh to restart."
