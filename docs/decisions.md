# Decisions

Decisions taken on Twake Drive (web), oldest first. Append only: a decision that changes gets a new entry that replaces the old one and cites it. Entry format: the `twake-decisions` skill of [linagora/twake-guidelines](https://github.com/linagora/twake-guidelines/blob/main/skills/twake-decisions/SKILL.md).

Categories: UX, UI, Product, Architecture, Infra, Tech.

## 2026-11-23, [UX] The scribe writes nothing in the document without a click

- Decision: what the scribe puts in the document, an answer or a call of a capability (a slide, a chart), waits for a click of the user: Insert, Replace or Apply under an answer, the button of the card of a call (`confirm: true`).
- Decided by: Paul Tran-Van, in a session with an agent (Claude Code), 2026-11-23
- Why: the user sees what goes in the document, and chooses to put it there.
- Scope: desktop and mobile, the scribe of OnlyOffice in text documents, presentations and spreadsheets; the cards of twake-assistant.

## 2026-11-23, [Product] A table comes in an answer, not through a capability

- Decision: a text document gives the assistant no `insert_table` capability; the "Make a table" chip asks for an answer, whose table the assistant shows as a table, under Insert and Replace.
- Decided by: Paul Tran-Van, in a session with an agent (Claude Code), 2026-11-23
- Why: a call showed no table before it was written, the production LLM seldom called it, and once in the history it made the LLM write its next tables as text rows.
- Scope: desktop and mobile, the scribe of OnlyOffice in text documents.

## 2026-11-23, [UX] Open move destinations with one click

- Decision: clicking or tapping an eligible folder row opens it; confirmation moves into the currently open folder, not a selected row.
- Decided by: Bobpodvalnyi (product owner), [#4637](https://github.com/linagora/twake-drive/issues/4637).
- Why: use the same gesture on desktop and mobile while keeping the open destination explicit before confirmation.
- Scope: new MoveTo dialog and MOVE intent on desktop and mobile; legacy, public, and PICK flows are unchanged.

## 2026-11-23, [Architecture] Grant Drive read-only access to public link events

- Decision: The Drive webapp manifest grants whole-type `GET` access to `io.cozy.public_links.events` independently of `drive.public_link_events.enabled`, with no write access granted by this rule.
- Decided by: doubleface, [#4635](https://github.com/linagora/twake-drive/pull/4635).
- Why: The Stack statistics endpoint requires this permission to export public link reports. Disabling collection does not withdraw the permission or erase past events.
- Scope: Drive webapp manifest and public link CSV export on a compatible Stack.

## 2026-11-23, [Product] Gate expiration reports on the public link statistics flag

- Decision: Drive opts into the sharing modal's expiration report setting only when the flag `drive.public_link_events.enabled` read by Drive is strictly `true`.
- Decided by: doubleface, [#4635](https://github.com/linagora/twake-drive/pull/4635).
- Why: The report relies on public link activity collection in Stack.
- Scope: Drive web file and folder sharing, including the editor toolbar, using the sharing library's existing access rules. When `drive.new-file-viewer-ui.enabled` is off, the modal opened by cozy-viewer's toolbar, footer or sharing panel does not show the setting because cozy-viewer does not forward `enableActivityReport`.

## 2026-11-24, [Tech] Loaders use the CircularProgress of cozy-ui, with props twake-mui shares

- Decision: a loader is a `CircularProgress` from `cozy-ui/transpiled/react/CircularProgress`, never the cozy-ui `Spinner`; it only takes `size`, `color` (`primary` or `inherit`), `className`, and utility classes that twake-css also ships, so the switch to twake-mui only rewrites the import.
- Decided by: Julien Ficheux, in a session with an agent (Claude Code), 2026-11-24, [linagora/twake-drive#4449](https://github.com/linagora/twake-drive/issues/4449)
- Why: twake-mui leaves the `Spinner` out, and `sx`, inline styles or `classes` would not survive the move from MUI v4 to v9.
- Scope: desktop and mobile, every loader of Drive.

## 2026-11-24, [UI] Full-screen loaders stay at 80px

- Decision: a full-screen or full-view loader is an 80px `CircularProgress`, the size of the former `xxlarge` Spinner.
- Decided by: Julien Ficheux, in a session with an agent (Claude Code), 2026-11-24, to be confirmed by Swann Maillard (design)
- Why: keeps the layout of the loading states unchanged while the spinner icon becomes the MUI ring.
- Scope: desktop and mobile, the loaders of the viewer, OnlyOffice, Excalidraw, file history, folder customizer, icon picker, upload and public notes.
