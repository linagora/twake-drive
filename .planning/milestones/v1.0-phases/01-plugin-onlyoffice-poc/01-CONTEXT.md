# Phase 1: Plugin OnlyOffice POC - Context

**Gathered:** 2026-02-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Set up a working OnlyOffice plugin development environment with fast iteration (Docker volume mount, no manual rebuilds), then build a minimal plugin that loads in the editor, detects text selection, reads selected text, replaces selected text, and inserts text after selection. This is a POC to validate the OnlyOffice plugin API before building Scribe features.

</domain>

<decisions>
## Implementation Decisions

### Dev workflow in Docker
- Docker setup is via standalone `docker run` command (not docker-compose)
- Browser refresh after file edit is acceptable iteration speed — no need for hot reload
- Running a reload script (e.g., `./reload-plugin.sh`) is also acceptable
- Docker config changes should be documented only — don't modify Docker config files in the repo
- Dev setup is for local use only for now — optimize for the developer's machine, document for team later

### Plugin scope & behavior
- POC plugin should be the foundation for the production plugin — write clean code that evolves
- Feedback mechanism: both console logs for dev and a minimal visual indicator to confirm it works
- For replace/insert tests: use the mock transform from MOCK-01 (prefix lines with `$ `, add text at start/end)
- Plugin should have a small test panel with buttons: "Read selection", "Replace", "Insert" — makes testing faster and more visual

### Testing & validation
- Validation approach: manual testing with a written test plan / checklist documenting what to verify
- Test documents: start with a simple plain text .docx, add a formatted doc later in the phase to test formatting behavior early
- Validate incrementally: each capability tested as it's built (env → load → select → replace → insert)
- Failure mode: depends on severity — minor issues get workarounds and documentation, fundamental API gaps stop the phase for reassessment

### Project structure
- Plugin source lives inside this repo (e.g., `plugins/onlyoffice-scribe/` or similar)
- Documentation: in the plugin directory — README.md next to the plugin source code with setup instructions and API findings
- Plugin name: `scribe` — simple, matches the project name
- Build: plain JS files, no build step — raw JS loaded directly by OnlyOffice (matches OO plugin conventions)

</decisions>

<specifics>
## Specific Ideas

- The test panel should make it obvious at a glance whether each API capability works — think "status dashboard" for the POC
- Mock transform (MOCK-01) should be used consistently: prefix each line with `$ ` and add text markers at beginning and end of the block
- Incremental validation means each success criterion is a milestone — don't move to the next until the previous is confirmed working

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-plugin-onlyoffice-poc*
*Context gathered: 2026-02-28*
