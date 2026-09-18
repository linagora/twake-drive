# Twake Drive: agent guide

React 18 front-end of Twake Drive, running inside a Cozy/Twake stack.
Data goes through `cozy-client`. E2E rules live in `e2e/AGENTS.md`.

## Commands

- `yarn lint`: ESLint (with Prettier) and stylint
- `yarn test`: Jest unit tests
- `yarn build`: production build (rsbuild)

## JavaScript / TypeScript

- `async` / `await`, not `.then()` chains (`Promise.all` is fine).
- Return `null` for an intentionally absent value, never `undefined`.
- Dates: `Intl` first, then `date-fns`. Never `moment`.
- Cozy app links go through `AppLinker`, never `window.location` or
  `window.open`.
- Comments explain business "why" only.

## Naming

- Function prefixes match behaviour: `fetch` (async I/O), `get` (sync
  getter), `find` (value or `null`), `has` / `is` (boolean), `compute`
  (pure derivation), `make` (factory), `normalize`, `save`, `ensure`
  (idempotent create), `...AndForget` (fire and forget).
- `Q()` queries get an `as` alias: the doctype, plus parameters when
  parameterized (`io.cozy.files/${folderId}/`). Query definitions live in
  `src/queries`.
- Imports: external libs, then `cozy-*` / `twake-*`, then local files and
  styles, separated by blank lines.

## React

- Functional components, named exports.
- `React.memo`, `useMemo`, `useCallback` only when there is a measured or
  structural need.
- UI components come from `cozy-ui`. Never import `@mui/material`
  directly, no inline `style` or raw `sx`.
- Icons from `@linagora/twake-icons` are passed as components, not strings.

## Tests

- `@testing-library/react`. No Enzyme, no snapshot tests.
- Colocated `*.spec.{js,jsx,ts,tsx}` files, no `__tests__` folders.
- Assert absence with `queryBy...` + `.toBe(null)`, presence with
  `.toBeInTheDocument()`.

## Locales

Only `src/locales/en.json` is edited by hand. Other languages come from
Transifex.
