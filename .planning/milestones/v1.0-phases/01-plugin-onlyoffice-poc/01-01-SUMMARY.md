---
phase: 01-plugin-onlyoffice-poc
plan: 01
status: complete
started: 2026-02-28
completed: 2026-02-28
---

# Plan 01-01 Summary: Dev Environment Setup

## What Was Built

Plugin scaffold and Docker dev environment for OnlyOffice plugin development.

### Files Created/Modified

| File | Purpose |
|------|---------|
| `plugins/onlyoffice-scribe/config.json` | Plugin manifest (GUID, type background, initOnSelectionChanged) |
| `plugins/onlyoffice-scribe/index.html` | Entry point loading OO Plugin SDK and code.js |
| `plugins/onlyoffice-scribe/scripts/code.js` | Minimal plugin skeleton (logs init + selection) |
| `plugins/onlyoffice-scribe/resources/light/icon.png` | 40x40 placeholder icon (light theme) |
| `plugins/onlyoffice-scribe/resources/dark/icon.png` | 40x40 placeholder icon (dark theme) |
| `plugins/onlyoffice-scribe/README.md` | Full dev setup docs, Docker details, troubleshooting |
| `plugins/onlyoffice-scribe/test-editor.html` | Standalone test page for editor (bypasses example app) |
| `scripts/oo-dev-setup.sh` | Docker setup script with volume mount |

## Key Findings

- **OO Version:** 9.3.0-138 (well above 8.2.1 minimum — initOnSelectionChanged is safe)
- **Plugin loads:** Confirmed via `[Scribe] Plugin loaded` in console
- **Selection detection:** Works — console logs selected text on selection change
- **Volume mount:** Host edits are picked up on browser refresh

## Issues Encountered & Resolved

1. **JWT blocks access:** OO >= 7.2 enables JWT by default → fixed with `JWT_ENABLED=false`
2. **Example page disabled:** Need `DS_EXAMPLE_ENABLE=true` + `supervisorctl start ds:example` → added to setup script
3. **SSRF protection blocks localhost:** OO document service refuses to fetch from private IPs → fixed with `ALLOW_PRIVATE_IP_ADDRESS=true`
4. **File ownership changed by Docker:** Volume mount changes file ownership to container user → documented workaround (`sudo chown`)
5. **Welcome page redirect:** `/` redirects to `/welcome/` — editor accessed via `/example/`

## Decisions Made

- Disable JWT, SSRF protection, and enable example service for local dev Docker
- Access editor via `http://localhost/example/` (not root URL)
- Document file ownership workaround in README

## Requirements Covered

- **ENV-01:** Plugin install process documented in README
- **ENV-02:** Volume mount works (host → container)
- **ENV-03:** Edit → hard refresh → change visible (seconds)
- **PLUG-01:** Plugin loads in OO editor (confirmed)

## Commits

| Hash | Message |
|------|---------|
| `decdb9e97` | feat(01-01): create plugin scaffold and Docker dev setup script |
| `aa9335572` | docs(01-01): write plugin dev setup documentation |
| `301a68709` | fix(01-01): fix Docker setup for local dev and record OO version |
