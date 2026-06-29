#!/usr/bin/env bash
#
# build-image.sh — Build a Scribe-patched OnlyOffice Document Server image.
#
# Produces an image derived from a base OO 9.4.0-129 image, with our patched
# sdk-all.js and the Scribe plugin baked in (see ./Dockerfile). Run it on any
# machine with Docker and the artifacts; push the result to your registry and
# point the K8s deployment at it.
#
# WHAT IT DOES
#   1. Resolves the patched sdk-all.js artifact (local file/dir/tarball or URL).
#   2. Resolves the Scribe addon source (this repo by default, a local path, or a
#      Drive git tag — "the latest beta").
#   3. Stamps a cache-bust token into the plugin's index.html (so browsers re-fetch
#      code.js on every version bump) and drops stale .gz.
#   4. Assembles a build context and runs `docker build`.
#
# USAGE
#   ./build-image.sh --sdk <path|tarball|url> [options]
#
#   --sdk <src>          REQUIRED. Patched sdk-all.js: a file, a dir containing it,
#                        a .tar.gz, or an http(s) URL to such a tarball.
#   --base <image>       Base OO image (default onlyoffice/documentserver:9.4.0.1,
#                        which is build 9.4.0-129). Use the integration team's image.
#   --addon <dir>        Local plugin dir (default: this repo's plugins/onlyoffice-scribe).
#   --addon-ref <tag>    Instead of --addon: fetch the addon from the Drive git repo
#                        at this tag (needs --addon-repo). Empty + --addon-ref-latest
#                        resolves the highest v*-beta.* tag.
#   --addon-repo <url>   Drive git remote (for --addon-ref).
#   --tag <image:tag>    Output image tag (default scribe-onlyoffice:9.4.0-129-<build>).
#   --expect <ver>       OO version the patch targets (default 9.4.0-129; build guard).
#   --push               docker push the produced image after build.
#
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "${HERE}/../../.." && pwd)"

SDK_SRC="${SDK_SRC:-}"
BASE_IMAGE="${BASE_IMAGE:-onlyoffice/documentserver:9.4.0.1}"
ADDON_DIR="${ADDON_DIR:-${REPO_ROOT}/plugins/onlyoffice-scribe}"
ADDON_REF="${ADDON_REF:-}"
ADDON_REPO="${ADDON_REPO:-}"
ADDON_REF_LATEST=false
OUTPUT_TAG="${OUTPUT_TAG:-}"
EXPECT_OO_VERSION="${EXPECT_OO_VERSION:-9.4.0-129}"
DO_PUSH=false

while [ $# -gt 0 ]; do
  case "$1" in
    --sdk)               SDK_SRC="$2"; shift 2 ;;
    --base)              BASE_IMAGE="$2"; shift 2 ;;
    --addon)             ADDON_DIR="$2"; shift 2 ;;
    --addon-ref)         ADDON_REF="$2"; shift 2 ;;
    --addon-ref-latest)  ADDON_REF_LATEST=true; shift ;;
    --addon-repo)        ADDON_REPO="$2"; shift 2 ;;
    --tag)               OUTPUT_TAG="$2"; shift 2 ;;
    --expect)            EXPECT_OO_VERSION="$2"; shift 2 ;;
    --push)              DO_PUSH=true; shift ;;
    -h|--help)           grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done

log()  { echo "[build-image] $*"; }
die()  { echo "[build-image] ERROR: $*" >&2; exit 1; }
have() { command -v "$1" >/dev/null 2>&1; }

[ -n "$SDK_SRC" ] || die "--sdk is required (patched sdk-all.js source)."
have docker || die "docker not found."

WORK="$(mktemp -d)"
CTX="$WORK/ctx"
mkdir -p "$CTX"
trap 'rm -rf "$WORK"' EXIT

# ── 1. Patched sdk-all.js → $CTX/sdk-all.js ──────────────────────────────────
case "$SDK_SRC" in
  http://*|https://*)
    have curl || die "curl needed for URL --sdk."
    curl -fsSL "$SDK_SRC" -o "$WORK/sdk.tar.gz" || die "sdk download failed."
    mkdir -p "$WORK/sdk"; tar -xzf "$WORK/sdk.tar.gz" -C "$WORK/sdk"
    f="$(find "$WORK/sdk" -name sdk-all.js | head -1)"; [ -n "$f" ] && cp "$f" "$CTX/sdk-all.js" ;;
  *.tar.gz|*.tgz)
    mkdir -p "$WORK/sdk"; tar -xzf "$SDK_SRC" -C "$WORK/sdk"
    f="$(find "$WORK/sdk" -name sdk-all.js | head -1)"; [ -n "$f" ] && cp "$f" "$CTX/sdk-all.js" ;;
  *)
    if [ -f "$SDK_SRC" ]; then cp "$SDK_SRC" "$CTX/sdk-all.js"
    elif [ -d "$SDK_SRC" ] && [ -f "$SDK_SRC/sdk-all.js" ]; then cp "$SDK_SRC/sdk-all.js" "$CTX/sdk-all.js"
    else die "--sdk not found / no sdk-all.js: $SDK_SRC"; fi ;;
esac
[ -s "$CTX/sdk-all.js" ] || die "could not obtain sdk-all.js from --sdk."
grep -q "GetInlineDrawings" "$CTX/sdk-all.js" || die "sdk-all.js does NOT contain the patch (GetInlineDrawings)."
log "sdk-all.js OK ($(wc -c <"$CTX/sdk-all.js") bytes, patch present)."

# ── 2. Scribe addon → $CTX/scribe ────────────────────────────────────────────
if [ -n "$ADDON_REF" ] || [ "$ADDON_REF_LATEST" = "true" ]; then
  have git || die "git needed for --addon-ref."
  [ -n "$ADDON_REPO" ] || die "--addon-repo required with --addon-ref."
  if [ "$ADDON_REF_LATEST" = "true" ] && [ -z "$ADDON_REF" ]; then
    ADDON_REF="$(git ls-remote --tags --refs "$ADDON_REPO" 'v*-beta.*' | awk '{print $2}' | sed 's#refs/tags/##' | sort -V | tail -1)"
    [ -n "$ADDON_REF" ] || die "no v*-beta.* tag on $ADDON_REPO."
  fi
  log "Cloning addon $ADDON_REPO @ $ADDON_REF ..."
  git clone --depth 1 --branch "$ADDON_REF" "$ADDON_REPO" "$WORK/repo" >/dev/null 2>&1 || die "clone failed."
  ADDON_DIR="$WORK/repo/plugins/onlyoffice-scribe"
fi
[ -f "$ADDON_DIR/config.json" ] || die "addon config.json not found in $ADDON_DIR"
cp -a "$ADDON_DIR" "$CTX/scribe"
find "$CTX/scribe" -name '*.gz' -delete 2>/dev/null || true

# ── 3. Cache-bust stamp (index.html → code.js?v=<token>) ─────────────────────
# Token = the SCRIBE_BUILD string in code.js (changes exactly when code.js does),
# sanitised. This forces browsers to re-fetch code.js whenever the build changes.
BUILD_STR="$(grep -o 'SCRIBE_BUILD *= *"[^"]*"' "$CTX/scribe/scripts/code.js" | sed 's/.*= *"//; s/".*//' | head -1 || true)"
TOKEN="$(printf '%s' "${BUILD_STR%% *}" | tr -c 'A-Za-z0-9._-' '-')"
[ -n "$TOKEN" ] || TOKEN="build"
sed -i -E "s#(src=\"scripts/code\.js)(\?v=[^\"]*)?\"#\1?v=${TOKEN}\"#" "$CTX/scribe/index.html"
log "Cache-bust token: ?v=${TOKEN}"

# ── 4. Build ─────────────────────────────────────────────────────────────────
cp "$HERE/Dockerfile" "$CTX/Dockerfile"
[ -n "$OUTPUT_TAG" ] || OUTPUT_TAG="scribe-onlyoffice:${EXPECT_OO_VERSION}-${TOKEN}"
log "Building ${OUTPUT_TAG} (base ${BASE_IMAGE}) ..."
docker build \
  --build-arg "BASE_IMAGE=${BASE_IMAGE}" \
  --build-arg "EXPECT_OO_VERSION=${EXPECT_OO_VERSION}" \
  -t "${OUTPUT_TAG}" "$CTX"

log "✅ Built ${OUTPUT_TAG}"
if [ "$DO_PUSH" = "true" ]; then
  log "Pushing ${OUTPUT_TAG} ..."
  docker push "${OUTPUT_TAG}"
fi
cat <<EOF

Next:
  • Smoke-check:  docker run --rm -p 8090:80 -e JWT_ENABLED=false ${OUTPUT_TAG}
                  curl -s localhost:8090/sdkjs/word/sdk-all.js | grep -c GetInlineDrawings   # > 0
  • Deploy: push to your registry and set the K8s pod image to ${OUTPUT_TAG}.
  • The patch is version-locked to ${EXPECT_OO_VERSION}; rebuild for any other OO build.
EOF
