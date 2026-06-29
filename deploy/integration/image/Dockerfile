# Scribe-patched OnlyOffice Document Server image.
#
# Derives from an existing OO image and bakes in:
#   • our patched sdkjs word bundle (sdk-all.js with ApiRun.GetInlineDrawings)
#   • the Scribe plugin (sdkjs-plugins/scribe)
#
# This is the durable, K8s-native packaging of the same artifacts the runtime
# scripts in ../ install — the patch lives in the image layer, so it survives pod
# restarts (no ephemeral-filesystem problem).
#
# Build context is assembled by build-image.sh (it puts the patched sdk-all.js and
# the cache-bust-stamped plugin next to this Dockerfile). Build directly with:
#   docker build --build-arg BASE_IMAGE=<oo-image> -t <out> .
#
# NOTES
#   • BASE_IMAGE must be OnlyOffice 9.4.0-129 — the compiled patch is version-locked
#     to that exact build (a mismatch breaks the editor). The RUN guard enforces it.
#     Point BASE_IMAGE at the integration team's customised image (it layers on top).
#   • No plugin registration step is needed: OO discovers installed plugins by the
#     presence of their directory under sdkjs-plugins/ (verified — pluginsmanager does
#     NOT add Scribe to plugin-list-default.json, yet the plugin loads). plugin-list-
#     default.json is only the default-enabled marketplace subset.
#   • No JWT/secret/config is baked in — those stay runtime (injected by K8s).
#   • sdk-all.js has no pre-gzipped .gz in the image, so the bind/copy is served as-is.

ARG BASE_IMAGE=onlyoffice/documentserver:9.4.0.1
FROM ${BASE_IMAGE}

# Fail the build early if the base is not the exact OO build the patch targets.
ARG EXPECT_OO_VERSION=9.4.0-129
RUN dpkg-query -W -f='${Version}\n' onlyoffice-documentserver | grep -qx "${EXPECT_OO_VERSION}" \
    || (echo "ERROR: base OnlyOffice is not ${EXPECT_OO_VERSION} — the compiled sdkjs patch is version-locked and would break the editor." >&2; exit 1)

# Patched sdkjs word bundle (builder API + GetInlineDrawings). On 9.4 apiBuilder.js
# lives only in sdk-all.js, so this single file carries the patch; sdk-all-min.js
# stays stock.
COPY sdk-all.js /var/www/onlyoffice/documentserver/sdkjs/word/sdk-all.js

# Scribe plugin (index.html is cache-bust-stamped by build-image.sh so browsers
# re-fetch code.js on every version bump).
COPY scribe/ /var/www/onlyoffice/documentserver/sdkjs-plugins/scribe/
