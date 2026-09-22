# Agent rules for twake-drive

Coding standards for AI agents working in this repository, the web client of
Twake Drive (React 18, running inside a Cozy/Twake stack).

## Two-tier rule structure

Generic Twake/Cozy conventions live in
[linagora/twake-guidelines](https://github.com/linagora/twake-guidelines).
The repo-specific decisions documented here take precedence when they
conflict. E2E rules live in `e2e/AGENTS.md`.

## Core architecture principles

**All data flows through `cozy-client`.** Queries are defined in
`src/queries` and consumed with `useQuery`. No ad-hoc `fetch` against the
stack. A `Q()` query carries an `as` alias: the doctype, plus its parameters
when parameterized (`io.cozy.files/${folderId}/`).

**Realtime over websockets.** Unlike the mobile app, the web client holds a
live connection: the `RealtimePlugin` from `cozy-realtime` is registered in
`src/lib/registerClientPlugins.js`, and `FilesRealTimeQueries` subscribes to
`io.cozy.files` events to keep the store in sync. Prefer letting realtime
update the cache over refetching or manual `statById` polling. Remember that
the hub echoes a notification back to its own sender.

**Sharing is the sensitive surface.** Shared drives, sharings and the data
proxy (`cozy-web-data-proxy`) move data across instances. Permission,
ownership and realtime-scope bugs there are the most costly, so changes in
`src/modules/shareddrives` and around sharings deserve extra care and tests.

**UI comes from the design system.** Components from `cozy-ui`, icons from
`@linagora/twake-icons` passed as components, never as strings. Never import
`@mui/material` directly. No inline `style={{...}}` and no raw `sx`: if the
design system lacks the variant you need, ask rather than work around it.

**Every user-facing string is translated.** Keys live in `src/locales`, and
all 15 languages are maintained in this repository, not through an external
service. A new key is added to `en.json` and to every other language file
before merge.

**Consistency with the mobile client.** Before an architecture decision, look
at how [twake-drive-mobile](https://github.com/linagora/twake-drive-mobile)
solves the same problem, and vice versa.

## Conventions

- `async` / `await`, not `.then()` chains (`Promise.all` is fine).
- Return `null` for an intentionally absent value, never `undefined`.
- Dates: `Intl` first, then `date-fns`. Never `moment`.
- Cozy app links go through `AppLinker`, never `window.location`.
- Function prefixes match behaviour: `fetch` (async I/O), `get` (sync
  getter), `find` (value or `null`), `has` / `is`, `compute`, `make`,
  `normalize`, `save`, `ensure`, `...AndForget`.
- Imports in three groups: external libs, then `cozy-*` / `twake-*`, then
  local files and styles.
- Functional components, named exports. `React.memo`, `useMemo` and
  `useCallback` only when there is a measured or structural need.
- Comments explain business "why" only.

## Tests

- `@testing-library/react`. No Enzyme, no snapshot tests.
- Colocated `*.spec.{js,jsx,ts,tsx}` files, no `__tests__` folders.
- Assert absence with `queryBy...` + `.toBe(null)`, presence with
  `.toBeInTheDocument()`.
- `yarn lint` (ESLint with Prettier, and stylint), `yarn test` (Jest),
  `yarn build` (rsbuild). E2E specs run with Playwright, see `docs/e2e.md`.

## Before opening a PR

- Cache and realtime stay consistent after the mutation, with no manual
  refetch that realtime already covers.
- Sharing and shared-drive changes are covered by tests, including the
  recipient side.
- New UI uses `cozy-ui` components, with no inline style and no raw MUI.
- Every new string has a key in all 15 language files.
- The mobile counterpart was considered.
- `yarn lint` and `yarn test` pass.
