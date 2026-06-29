# Scribe-patched OnlyOffice image

Build a derived OnlyOffice Document Server image with our patched sdkjs + the
Scribe addon baked in — the **durable, K8s-native** packaging (the patch lives in
the image layer, so it survives pod restarts). This supersedes the runtime scripts
in `../` for production; those remain handy for quick patching of a running container.

## Build (on any machine with Docker + the artifacts)

```bash
./build-image.sh --sdk <patched-sdk-all.js or .tar.gz or URL>
```

Defaults: base `onlyoffice/documentserver:9.4.0.1` (= build `9.4.0-129`), addon =
this repo's `plugins/onlyoffice-scribe`, tag `scribe-onlyoffice:9.4.0-129-<build>`.

Common overrides:

```bash
# Layer on the integration team's customised base image:
./build-image.sh --sdk ./sdk-all.js --base registry.example/oo-custom:9.4.0-129

# Pull the addon from a Drive git tag instead of the local tree:
./build-image.sh --sdk ./sdk-all.js --addon-repo <drive-git-url> --addon-ref-latest

# Build and push:
./build-image.sh --sdk ./sdk-all.js --tag registry.example/scribe-oo:9.4.0-129-b12 --push
```

## What the build does / guarantees (POC-verified)

- **Version guard**: the build FAILS if the base is not `9.4.0-129` — the compiled
  patch is version-locked. Override the target with `--expect`.
- **sdk-all.js**: patch presence (`GetInlineDrawings`) checked before baking. On 9.4
  the builder API lives only in `sdk-all.js`; `sdk-all-min.js` stays stock.
- **No registration needed**: OO loads the plugin by the presence of its directory
  under `sdkjs-plugins/` (verified: `pluginsmanager` does not add Scribe to
  `plugin-list-default.json`, yet the plugin loads — same as the dev container).
- **Cache invalidation**: `index.html` is stamped `code.js?v=<SCRIBE_BUILD>` so
  browsers re-fetch `code.js` on every version bump; `[Scribe] build …` in the
  console confirms which build is live.
- **No secrets/config baked**: JWT and stack config stay runtime (injected by K8s).
- **Persists at runtime**: baked files survive OO's startup init (POC-confirmed).

## Caveats

- Derive from the **image** (`FROM <tag>`), never from a `docker commit` of a running
  container (non-reproducible).
- Rebuild the sdkjs patch (and this image) for any OnlyOffice build other than
  `9.4.0-129` — see `../README.md` and the sdkjs worktree.
