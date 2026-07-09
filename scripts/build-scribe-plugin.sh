#!/usr/bin/env bash
#
# build-scribe-plugin.sh - Build a deployable Scribe plugin package
#
# Usage: Run from the repository root:
#   yarn build:scribe-plugin
#
# Output: build-scribe-OO-plugin/ containing only the files needed for deployment

set -euo pipefail

SOURCE="plugins/onlyoffice-scribe"
OUTPUT="build-scribe-OO-plugin"

if [ ! -d "$SOURCE" ]; then
  echo "Error: $SOURCE not found. Run from the repository root."
  exit 1
fi

# Clean previous build
rm -rf "$OUTPUT"
mkdir -p "$OUTPUT/scripts" "$OUTPUT/resources/light" "$OUTPUT/resources/dark"

# Copy plugin files
cp "$SOURCE/config.json"             "$OUTPUT/"
cp "$SOURCE/index.html"              "$OUTPUT/"
cp "$SOURCE/scripts/code.js"         "$OUTPUT/scripts/"
cp "$SOURCE/resources/light/icon.png" "$OUTPUT/resources/light/"
cp "$SOURCE/resources/dark/icon.png"  "$OUTPUT/resources/dark/"

# Extract version from config.json
VERSION=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$OUTPUT/config.json','utf8')).version)")

echo ""
echo "Scribe plugin v${VERSION} built to ${OUTPUT}/"
echo ""
ls -R "$OUTPUT"
echo ""
echo "Deploy: copy ${OUTPUT}/ to /var/www/onlyoffice/documentserver/sdkjs-plugins/scribe/"
