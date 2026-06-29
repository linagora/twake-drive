#!/usr/bin/env bash
#
# deploy-scribe-addon.sh — Deploy the Scribe OnlyOffice plugin into a running
# OnlyOffice Document Server container (integration environment).
#
# WHAT THIS DOES
#   1. Resolves which Scribe build to deploy ("the latest beta", or an explicit tag).
#   2. Fetches the plugin files from the Drive git repo at that ref
#      (or installs from a local path/tarball — no git needed in that mode).
#   3. Stamps a cache-busting token into index.html so browsers re-fetch code.js.
#   4. Stamps a deploy banner into code.js so the running build is visible in the
#      browser console AND in the network tab (version traceability).
#   5. Copies the files into the OO server-side plugins directory.
#   6. Removes stale .gz files (OO pre-compresses assets; a stale .gz is the #1
#      cause of "I deployed but the browser still runs the old code").
#   7. Registers the plugin with OnlyOffice and prints verification steps.
#
# WHERE TO RUN
#   Inside the OnlyOffice container (the one serving the editor). Typically:
#       kubectl exec -it <oo-pod> -- bash        # or: docker exec -it <oo-ctr> bash
#       ./deploy-scribe-addon.sh
#   It only touches the container-local filesystem — no kubectl/docker needed
#   from inside. It can equally be invoked as a RUN step when the image is built
#   upstream (durable install).
#
# IDEMPOTENT: safe to re-run. Each run fully replaces the plugin directory.
#
# ─────────────────────────────────────────────────────────────────────────────
# CONFIGURE ME (or override via env / flags)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# Git repo that contains the Scribe plugin (plugins/onlyoffice-scribe/) and the
# release tags. Scribe ships inside the Drive repo, so this is the Drive repo URL.
# ►► TODO: set this to your internal Drive git remote (must be reachable from the
#    container, OR use --from to skip git entirely).
SCRIBE_GIT_REPO="${SCRIBE_GIT_REPO:-}"

# How "the latest beta" is characterised in git: the highest tag matching this
# glob, ordered as versions. Default = the existing Drive beta convention
# (v1.62.0-beta.3, v1.62.0-beta.10, ...). Change to e.g. 'scribe-v*-beta.*' if you
# adopt a Scribe-specific tag namespace later.
SCRIBE_TAG_PATTERN="${SCRIBE_TAG_PATTERN:-v*-beta.*}"

# Explicit ref to deploy (tag/branch/sha). Empty => auto-resolve latest matching
# SCRIBE_TAG_PATTERN. Override with: --ref <tag>
SCRIBE_REF="${SCRIBE_REF:-}"

# Install from a local path or tarball instead of git (offline mode).
# A directory must contain config.json/index.html/scripts/code.js; a .tar.gz must
# unpack to the same. Override with: --from <path>
SCRIBE_FROM="${SCRIBE_FROM:-}"

# Path of the plugin inside the repo.
PLUGIN_SUBPATH="${PLUGIN_SUBPATH:-plugins/onlyoffice-scribe}"

# OO server-side plugins directory and the plugin folder name.
OO_PLUGINS_DIR="${OO_PLUGINS_DIR:-/var/www/onlyoffice/documentserver/sdkjs-plugins}"
PLUGIN_NAME="${PLUGIN_NAME:-scribe}"

# Restart the document service after install (flushes OO's plugin list cache).
# Usually NOT required for plugin asset changes; enable with --restart.
DO_RESTART="${DO_RESTART:-false}"

# ─────────────────────────────────────────────────────────────────────────────
# Args
# ─────────────────────────────────────────────────────────────────────────────
while [ $# -gt 0 ]; do
  case "$1" in
    --ref)     SCRIBE_REF="$2"; shift 2 ;;
    --from)    SCRIBE_FROM="$2"; shift 2 ;;
    --repo)    SCRIBE_GIT_REPO="$2"; shift 2 ;;
    --pattern) SCRIBE_TAG_PATTERN="$2"; shift 2 ;;
    --restart) DO_RESTART=true; shift ;;
    -h|--help)
      grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done

log()  { echo "[deploy-addon] $*"; }
die()  { echo "[deploy-addon] ERROR: $*" >&2; exit 1; }
have() { command -v "$1" >/dev/null 2>&1; }

TS="$(date +%Y%m%d-%H%M%S)"
WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

# ─────────────────────────────────────────────────────────────────────────────
# 1. Obtain the plugin source tree -> $SRC (must contain config.json + scripts/code.js)
# ─────────────────────────────────────────────────────────────────────────────
SRC=""
DEPLOY_TAG=""

if [ -n "$SCRIBE_FROM" ]; then
  # Offline mode: install from a local directory or tarball.
  if [ -d "$SCRIBE_FROM" ]; then
    SRC="$SCRIBE_FROM"
  elif [ -f "$SCRIBE_FROM" ]; then
    mkdir -p "$WORKDIR/from"
    tar -xzf "$SCRIBE_FROM" -C "$WORKDIR/from"
    # The tarball may contain the plugin dir at top level or nested.
    if [ -f "$WORKDIR/from/config.json" ]; then SRC="$WORKDIR/from";
    else SRC="$(dirname "$(find "$WORKDIR/from" -name config.json | head -1)")"; fi
  else
    die "--from path not found: $SCRIBE_FROM"
  fi
  DEPLOY_TAG="local-$TS"
  log "Installing from local source: $SRC (tag=$DEPLOY_TAG)"
else
  # Git mode: resolve ref, then shallow-clone it.
  have git || die "git not available in container; use --from <path|tarball> instead."
  [ -n "$SCRIBE_GIT_REPO" ] || die "SCRIBE_GIT_REPO is not set (edit the script or pass --repo / --from)."

  if [ -z "$SCRIBE_REF" ]; then
    log "Resolving latest beta matching '$SCRIBE_TAG_PATTERN' from $SCRIBE_GIT_REPO ..."
    SCRIBE_REF="$(git ls-remote --tags --refs "$SCRIBE_GIT_REPO" "$SCRIBE_TAG_PATTERN" \
                  | awk '{print $2}' | sed 's#refs/tags/##' | sort -V | tail -1)"
    [ -n "$SCRIBE_REF" ] || die "No tag matched '$SCRIBE_TAG_PATTERN' on $SCRIBE_GIT_REPO."
  fi
  DEPLOY_TAG="$SCRIBE_REF"
  log "Cloning $SCRIBE_GIT_REPO @ $SCRIBE_REF ..."
  git clone --depth 1 --branch "$SCRIBE_REF" "$SCRIBE_GIT_REPO" "$WORKDIR/repo" >/dev/null 2>&1 \
    || die "git clone failed for ref '$SCRIBE_REF'."
  SRC="$WORKDIR/repo/$PLUGIN_SUBPATH"
fi

[ -f "$SRC/config.json" ]       || die "config.json not found in source: $SRC"
[ -f "$SRC/scripts/code.js" ]   || die "scripts/code.js not found in source: $SRC"
[ -f "$SRC/index.html" ]        || die "index.html not found in source: $SRC"

# ─────────────────────────────────────────────────────────────────────────────
# 2. Soft OO version check (informational): warn if below the plugin's minVersion
# ─────────────────────────────────────────────────────────────────────────────
OO_VER="$(dpkg-query -W -f='${Version}' onlyoffice-documentserver 2>/dev/null || echo 'unknown')"
MIN_VER="$(grep -o '"minVersion"[^,]*' "$SRC/config.json" | grep -o '[0-9][0-9.]*' | head -1 || true)"
log "OnlyOffice version in container: $OO_VER (plugin minVersion: ${MIN_VER:-?})"

# Read the intrinsic build string the developer bumped in code.js (traceability).
SCRIBE_BUILD="$(grep -o 'SCRIBE_BUILD *= *"[^"]*"' "$SRC/scripts/code.js" \
               | sed 's/.*= *"//; s/"$//' | head -1 || true)"

# ─────────────────────────────────────────────────────────────────────────────
# 3. Stamp into a staging copy (never mutate the source tree in place)
# ─────────────────────────────────────────────────────────────────────────────
STAGE="$WORKDIR/stage"
mkdir -p "$STAGE"
cp -a "$SRC/." "$STAGE/"

# 3a. Cache-bust: rewrite the code.js (and vendor) <script src> with ?v=<tag>.
#     index.html is the plugin entry point OO loads; a versioned query string
#     forces every browser to fetch THIS build of code.js, defeating HTTP cache.
CACHE_TOKEN="$(printf '%s' "$DEPLOY_TAG" | tr -c 'A-Za-z0-9._-' '-')"
sed -i -E "s#(src=\"scripts/code\.js)(\?v=[^\"]*)?\"#\1?v=${CACHE_TOKEN}\"#" "$STAGE/index.html"
sed -i -E "s#(src=\"vendor/marked\.umd\.js)(\?v=[^\"]*)?\"#\1?v=${CACHE_TOKEN}\"#" "$STAGE/index.html" || true

# 3b. Deploy banner appended to code.js: guarantees the live build identifies
#     itself in the browser console regardless of caching, AND exposes the deploy
#     tag on window for scripted checks.
cat >> "$STAGE/scripts/code.js" <<EOF

/* --- injected by deploy-scribe-addon.sh on ${TS} --- */
try {
  window.__scribeDeploy = { tag: "${DEPLOY_TAG}", build: "${SCRIBE_BUILD}", at: "${TS}" };
  if (window.console && console.log) {
    console.log("[Scribe] deployed tag=${DEPLOY_TAG} build=${SCRIBE_BUILD}");
  }
} catch (e) {}
EOF

# 3c. Server-side audit trail.
echo "tag=${DEPLOY_TAG} build=${SCRIBE_BUILD} at=${TS} oo=${OO_VER}" > "$STAGE/DEPLOYED_VERSION.txt"

# ─────────────────────────────────────────────────────────────────────────────
# 4. Install: replace the plugin directory atomically-ish, keep a backup
# ─────────────────────────────────────────────────────────────────────────────
DEST="$OO_PLUGINS_DIR/$PLUGIN_NAME"
mkdir -p "$OO_PLUGINS_DIR"
if [ -d "$DEST" ]; then
  BAK="${DEST}.scribe-bak.${TS}"
  log "Backing up existing plugin -> $BAK"
  mv "$DEST" "$BAK"
fi
log "Installing plugin -> $DEST"
cp -a "$STAGE" "$DEST"

# 5. Remove stale pre-compressed copies (CRITICAL for cache correctness).
log "Removing stale .gz caches under $DEST"
find "$DEST" -name '*.gz' -delete 2>/dev/null || true

# ─────────────────────────────────────────────────────────────────────────────
# 6. Register with OnlyOffice
# ─────────────────────────────────────────────────────────────────────────────
PM="/usr/bin/documentserver-pluginsmanager.sh"
if [ -x "$PM" ]; then
  log "Registering plugin with OnlyOffice ..."
  "$PM" --directory="$OO_PLUGINS_DIR" \
        --update="$OO_PLUGINS_DIR/plugin-list-default.json" >/dev/null 2>&1 \
    || log "WARN: pluginsmanager returned non-zero (plugin may still load)."
else
  log "WARN: $PM not found — skipping registration (plugin usually still loads)."
fi

if [ "$DO_RESTART" = "true" ] && have supervisorctl; then
  log "Restarting ds:docservice ..."
  supervisorctl restart ds:docservice >/dev/null 2>&1 || log "WARN: docservice restart failed."
fi

# ─────────────────────────────────────────────────────────────────────────────
# Done
# ─────────────────────────────────────────────────────────────────────────────
cat <<EOF

[deploy-addon] ✅ Deployed.
    tag          : ${DEPLOY_TAG}
    code build   : ${SCRIBE_BUILD:-<unknown>}
    OO version   : ${OO_VER}
    destination  : ${DEST}
    cache token  : ?v=${CACHE_TOKEN}

VERIFY THE BROWSER IS ACTUALLY RUNNING THIS BUILD
  1. Open a .docx in the integration editor.
  2. Open DevTools (F12) → Console. You MUST see:
         [Scribe] deployed tag=${DEPLOY_TAG} build=...
     If you see an OLDER tag/build → the browser served a cached code.js:
        • DevTools → Network → disable cache → hard reload (Ctrl+Shift+R), and
        • confirm the request is  scripts/code.js?v=${CACHE_TOKEN}  (200, not 304/from-cache).
  3. DevTools → Network: the code.js request URL must end with ?v=${CACHE_TOKEN}.

ROLLBACK
    rm -rf "${DEST}" && mv "${DEST}.scribe-bak.${TS}" "${DEST}"
EOF
