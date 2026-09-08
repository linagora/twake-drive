# E2E suite — read this before writing or editing a spec

Everything here already exists. Reuse it, don't re-implement it. Full setup
docs: `../docs/e2e.md`.

## Hard rules

1. **No raw selectors in `tests/**`.** `page.locator()`, `getByTestId()`,
   `getByRole()`, `getByText()` belong in `pages/*.ts`. Missing an action?
   Add a method to the page object, don't inline it in the spec.
2. **No manual auth or contexts.** Never call `browser.newContext()` or
   `authenticate()` in a spec — take the `test` fixtures from
   `helpers/fixtures.ts`.
3. **Unique names come from `stamp()`**, never `Date.now()` / `Math.random()`.
4. **Seed over HTTP, assert through the UI.** If a fixture file/version can be
   created with `helpers/stack.ts`, don't click it into existence.
5. Temp files are removed with `safeUnlink()` in a `finally`.
6. A literal name used inside a `RegExp` goes through `escapeRegExp()`.

## Helpers (grep these before writing your own)

- `helpers/fixtures.ts` — the only place to import `test`/`expect` from.
  Fixtures: `alicePage`/`bobPage`/`charliePage` (authenticated pages that fail
  on console errors) + `aliceDrive`/`bobDrive`/`charlieDrive`. Also `stamp()`,
  `safeUnlink()`, `escapeRegExp()`.
- `helpers/config.ts` — `USERS.alice.appUrl`/`.email`/`.instance`,
  `stackExec()`. Never hardcode a URL, port or instance domain.
- `helpers/sharing.ts` — `createAndShareFolderWithBob()`,
  `waitForSharingRow()`, `openSharedDrive()`, `openOwnerFolder()`.
- `helpers/stack.ts` — `createFile()`, `overwriteFile()`,
  `countFileVersions()`, `waitForVersionWindow()`, `findLinkPermission()`,
  `setLinkExpiry()`.
- `helpers/flags.ts` — `setFlags(instance, {...})`.

Page objects live in `pages/` (DrivePage, FileRow, SidebarPage, ShareModal,
FileViewer, FilePicker, …). Read the file for its methods.

## Conventions

- Cross-instance sharing specs are prefixed `z-` so they run last.
- Only `*.mobile.spec.ts` runs in the `mobile` project; everything else is
  desktop chromium.
- Prefer `expect(...).toBeVisible()` / `toPass()` over `waitForTimeout()`.
