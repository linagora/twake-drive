#!/usr/bin/env bash
#
# deploy-sdkjs-patch.sh — Install the patched OnlyOffice sdkjs "word" bundles
# (the ones carrying ApiRun.GetInlineDrawings) into a running OnlyOffice
# Document Server container.
#
# WHY A SEPARATE SCRIPT FROM THE ADDON
#   The addon is plain static files. The sdkjs patch is *compiled* core editor
#   code (Closure Compiler), version-locked to the EXACT OnlyOffice version it was
#   built against. Installing a mismatched bundle BREAKS the editor. Therefore:
#     • This script does NOT build. It installs pre-compiled artifacts you
#       produced upstream (sdk-all.js + sdk-all-min.js for the word editor).
#     • It enforces a version guard (a configurable *range*) and refuses to apply
#       to an OO version outside that range, unless --force is given.
#
# ARTIFACTS EXPECTED  (produced upstream by your Closure Compiler build):
#     sdk-all.js          (non-minified word bundle, patched)
#     sdk-all-min.js      (minified word bundle, patched)
#   Optional: sdk-all.js.sha256 / sdk-all-min.js.sha256 for integrity checks.
#
# WHERE TO RUN
#   Inside the OnlyOffice container, same as deploy-scribe-addon.sh.
#
# ─────────────────────────────────────────────────────────────────────────────
# CONFIGURE ME (or override via env / flags)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# Source of the pre-compiled artifacts. May be:
#   • a local directory containing sdk-all.js + sdk-all-min.js
#   • a local .tar.gz that unpacks to those files
#   • an http(s) URL to such a .tar.gz (downloaded with curl)
# ►► TODO: wire this to wherever you publish the compiled bundles (a release
#    asset URL, an internal artifact store, or a path mounted into the container).
SDKJS_ARTIFACTS_SRC="${SDKJS_ARTIFACTS_SRC:-}"

# Version guard (SOFT, configurable range). The current integration target is
# 9.4.0-129 (artifacts built from upstream sdkjs tag v9.4.0.129). By default we
# accept ONLY that exact version (min == max). Widen the range once you have
# validated the same bundle against more OO builds, or override per-run.
#   For the legacy 9.3 bundle:  --min 9.3.0-138 --max 9.3.0-138
#   Example wider range:        --min 9.4.0-129 --max 9.4.0-199
OO_VERSION_MIN="${OO_VERSION_MIN:-9.4.0-129}"
OO_VERSION_MAX="${OO_VERSION_MAX:-9.4.0-129}"

# Target editor bundle directory inside the container.
OO_SDKJS_WORD_DIR="${OO_SDKJS_WORD_DIR:-/var/www/onlyoffice/documentserver/sdkjs/word}"

# A string that MUST be present in the patched bundles — proves the artifacts
# actually carry the patch before we overwrite anything.
PATCH_MARKER="${PATCH_MARKER:-GetInlineDrawings}"

FORCE=false      # bypass the version guard (expert use)
DO_ROLLBACK=false

# ─────────────────────────────────────────────────────────────────────────────
# Args
# ─────────────────────────────────────────────────────────────────────────────
while [ $# -gt 0 ]; do
  case "$1" in
    --src)      SDKJS_ARTIFACTS_SRC="$2"; shift 2 ;;
    --min)      OO_VERSION_MIN="$2"; shift 2 ;;
    --max)      OO_VERSION_MAX="$2"; shift 2 ;;
    --force)    FORCE=true; shift ;;
    --rollback) DO_ROLLBACK=true; shift ;;
    -h|--help)  grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done

log()  { echo "[deploy-sdkjs] $*"; }
die()  { echo "[deploy-sdkjs] ERROR: $*" >&2; exit 1; }
have() { command -v "$1" >/dev/null 2>&1; }

TS="$(date +%Y%m%d-%H%M%S)"
WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

FILES=(sdk-all.js sdk-all-min.js)

# ─────────────────────────────────────────────────────────────────────────────
# Rollback mode: restore the most recent backup, then exit.
# ─────────────────────────────────────────────────────────────────────────────
if [ "$DO_ROLLBACK" = "true" ]; then
  restored=0
  for f in "${FILES[@]}"; do
    LAST_BAK="$(ls -1t "${OO_SDKJS_WORD_DIR}/${f}.scribe-bak."* 2>/dev/null | head -1 || true)"
    [ -n "$LAST_BAK" ] || continue
    log "Restoring $f from $(basename "$LAST_BAK")"
    cp -a "$LAST_BAK" "${OO_SDKJS_WORD_DIR}/${f}"
    rm -f "${OO_SDKJS_WORD_DIR}/${f}.gz"
    restored=$((restored+1))
  done
  [ "$restored" -gt 0 ] || die "No backup (*.scribe-bak.*) found in $OO_SDKJS_WORD_DIR."
  log "✅ Rolled back ($restored file(s)). Hard-reload the editor (Ctrl+Shift+R) to drop cached SDK."
  exit 0
fi

# ─────────────────────────────────────────────────────────────────────────────
# 1. Version guard (soft, range-based)
# ─────────────────────────────────────────────────────────────────────────────
OO_VER="$(dpkg-query -W -f='${Version}' onlyoffice-documentserver 2>/dev/null || echo '')"
[ -n "$OO_VER" ] || die "Could not read OnlyOffice version (dpkg). Is this the OO container?"
log "OnlyOffice version in container : $OO_VER"
log "Accepted range                  : [$OO_VERSION_MIN .. $OO_VERSION_MAX]"

in_range=true
dpkg --compare-versions "$OO_VER" ge "$OO_VERSION_MIN" || in_range=false
dpkg --compare-versions "$OO_VER" le "$OO_VERSION_MAX" || in_range=false
if [ "$in_range" != "true" ]; then
  if [ "$FORCE" = "true" ]; then
    log "WARN: $OO_VER is OUTSIDE the accepted range — proceeding because --force."
  else
    die "$OO_VER is outside [$OO_VERSION_MIN..$OO_VERSION_MAX]. The compiled patch is
       version-locked and will break the editor on a mismatched core. Rebuild the
       bundle for $OO_VER, widen the range with --min/--max once validated, or
       override with --force (NOT recommended)."
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# 2. Obtain artifacts -> $ART (a directory containing the FILES)
# ─────────────────────────────────────────────────────────────────────────────
[ -n "$SDKJS_ARTIFACTS_SRC" ] || die "SDKJS_ARTIFACTS_SRC not set (edit the script or pass --src)."
ART=""
case "$SDKJS_ARTIFACTS_SRC" in
  http://*|https://*)
    have curl || die "curl needed to download artifacts."
    log "Downloading artifacts from $SDKJS_ARTIFACTS_SRC ..."
    curl -fsSL "$SDKJS_ARTIFACTS_SRC" -o "$WORKDIR/art.tar.gz" || die "download failed."
    mkdir -p "$WORKDIR/art"; tar -xzf "$WORKDIR/art.tar.gz" -C "$WORKDIR/art"
    ART="$WORKDIR/art" ;;
  *.tar.gz|*.tgz)
    [ -f "$SDKJS_ARTIFACTS_SRC" ] || die "tarball not found: $SDKJS_ARTIFACTS_SRC"
    mkdir -p "$WORKDIR/art"; tar -xzf "$SDKJS_ARTIFACTS_SRC" -C "$WORKDIR/art"
    ART="$WORKDIR/art" ;;
  *)
    [ -d "$SDKJS_ARTIFACTS_SRC" ] || die "artifacts dir not found: $SDKJS_ARTIFACTS_SRC"
    ART="$SDKJS_ARTIFACTS_SRC" ;;
esac
# If extraction produced a nested dir, locate the one holding the files.
if [ ! -f "$ART/sdk-all.js" ]; then
  found="$(find "$ART" -name sdk-all.js | head -1 || true)"
  [ -n "$found" ] && ART="$(dirname "$found")"
fi

# Install exactly the patched bundles the artifacts actually provide.
#   • OO 9.4: only sdk-all.js carries the builder API (apiBuilder.js) and thus the
#     patch — it is loaded by api/documents preload+cache-scripts (builder/callCommand
#     context). sdk-all-min.js is the stock minified editor engine; we do NOT touch it.
#   • OO 9.3 (Closure build): both bundles were patched.
PRESENT=()
for f in "${FILES[@]}"; do [ -s "$ART/$f" ] && PRESENT+=("$f"); done
[ ${#PRESENT[@]} -gt 0 ] || die "No known patched bundle (${FILES[*]}) found in $ART."
log "Patched bundles provided: ${PRESENT[*]}"

# ─────────────────────────────────────────────────────────────────────────────
# 3. Validate artifacts BEFORE touching the live editor
# ─────────────────────────────────────────────────────────────────────────────
for f in "${PRESENT[@]}"; do
  grep -q "$PATCH_MARKER" "$ART/$f" \
    || die "Artifact $f does NOT contain '$PATCH_MARKER' — wrong/unpatched bundle. Aborting."
  # Optional integrity check.
  if [ -f "$ART/$f.sha256" ] && have sha256sum; then
    (cd "$ART" && sha256sum -c "$f.sha256" >/dev/null 2>&1) \
      || die "Checksum mismatch for $f."
    log "Checksum OK: $f"
  fi
done
log "Artifacts validated (patch marker '$PATCH_MARKER' present in: ${PRESENT[*]})."

# ─────────────────────────────────────────────────────────────────────────────
# 4. Install: backup originals, copy patched bundles, drop stale .gz
# ─────────────────────────────────────────────────────────────────────────────
[ -d "$OO_SDKJS_WORD_DIR" ] || die "Target dir not found: $OO_SDKJS_WORD_DIR"
for f in "${PRESENT[@]}"; do
  TGT="$OO_SDKJS_WORD_DIR/$f"
  if [ -f "$TGT" ]; then
    cp -a "$TGT" "${TGT}.scribe-bak.${TS}"
    log "Backed up $f -> $(basename "${TGT}").scribe-bak.${TS}"
  fi
  cp -a "$ART/$f" "$TGT"
  # OO serves pre-gzipped assets via nginx gzip_static; a stale .gz would be
  # served INSTEAD of the freshly-patched file. Remove it so OO regenerates it.
  rm -f "${TGT}.gz"
  log "Installed $f"
done

# Audit trail next to the bundles.
echo "patched sdkjs installed at=${TS} oo=${OO_VER} src=${SDKJS_ARTIFACTS_SRC}" \
  > "$OO_SDKJS_WORD_DIR/SCRIBE_SDKJS_PATCH.txt"

# ─────────────────────────────────────────────────────────────────────────────
# 5. Post-install verification (on-disk + how to verify in-browser)
# ─────────────────────────────────────────────────────────────────────────────
for f in "${PRESENT[@]}"; do
  n="$(grep -c "$PATCH_MARKER" "$OO_SDKJS_WORD_DIR/$f" || true)"
  log "On-disk check: $f contains '$PATCH_MARKER' x$n"
done

cat <<EOF

[deploy-sdkjs] ✅ Patched sdkjs installed.
    OO version  : ${OO_VER}
    target dir  : ${OO_SDKJS_WORD_DIR}
    artifacts   : ${SDKJS_ARTIFACTS_SRC}

VERIFY THE PATCH IS ACTUALLY LIVE IN THE BROWSER
  The browser caches sdk-all*.js aggressively and OO does NOT change its asset
  URL when only the file content changes. After this install, EVERY tester must:
    • DevTools → Network → "Disable cache" → hard reload (Ctrl+Shift+R), or
    • clear the editor's cached SDK for the document.
  Then confirm: with a Scribe image-bearing document, the image round-trip works
  (the plugin uses apiRun.GetInlineDrawings(); without the patch it silently
  falls back and inline image markers misplace).

ROLLBACK
    ./deploy-sdkjs-patch.sh --rollback      # restores the latest .scribe-bak.*
EOF
