#!/bin/bash
set -euo pipefail

EDITOR_VERSION="v8.3.3.23+5"
X2T_VERSION="v8.3.0+0"

EDITOR_URL="https://github.com/cryptpad/onlyoffice-editor/releases/download/${EDITOR_VERSION}/onlyoffice-editor.zip"
X2T_URL="https://github.com/cryptpad/onlyoffice-x2t-wasm/releases/download/${X2T_VERSION}/x2t.zip"

VENDOR_DIR="vendor/cryptpad-onlyoffice"

# Resolve paths relative to project root
cd "$(dirname "$0")/.."

if [ -d "$VENDOR_DIR/editor" ] && [ -d "$VENDOR_DIR/x2t" ]; then
  echo "vendor/cryptpad-onlyoffice/ already exists. Remove it first to re-install."
  exit 0
fi

TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

echo "Downloading OnlyOffice editor ${EDITOR_VERSION}..."
curl -L -o "$TMP_DIR/editor.zip" "$EDITOR_URL"

echo "Downloading x2t-wasm ${X2T_VERSION}..."
curl -L -o "$TMP_DIR/x2t.zip" "$X2T_URL"

mkdir -p "$VENDOR_DIR"

echo "Extracting editor..."
unzip -q "$TMP_DIR/editor.zip" -d "$VENDOR_DIR/editor"

echo "Extracting x2t..."
unzip -q "$TMP_DIR/x2t.zip" -d "$VENDOR_DIR/x2t"

echo "Done. Installed to $VENDOR_DIR/"
