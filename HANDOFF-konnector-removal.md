# Handoff: remove Konnector support

## Branch

`chore/remove-konnector-support`

## Current state

The branch contains the application-side removal of Konnector and Harvest
features:

- Removed the Harvest banner and Harvest route from Drive.
- Removed Konnector and trigger query builders.
- Removed the Konnector file/folder badge and related helpers/constants.
- Removed Konnector, account, and trigger permissions from `manifest.webapp`.
- Removed the `cozy-konnector-dev` service script.
- Removed the Konnector-specific qualification migration branch.
- Kept the Cozy Scanner qualification migration.

The Konnector-specific qualification test was removed/renamed so that the
remaining test covers the Cozy Client qualification path.

## Blocking issue

`cozy-viewer@30.0.10` has a runtime import of:

`cozy-harvest-lib/dist/components/KonnectorBlock`

Therefore removing `cozy-harvest-lib` from `package.json` immediately breaks
Jest and the application while `cozy-viewer` is still used. The package is
currently kept in `package.json` only to satisfy this dependency.

## Next step

Before removing `cozy-harvest-lib` from this branch, update `cozy-viewer` so
that its Konnector panel block is removed or made optional, then bump/use that
version here. Do not edit `node_modules`; the fix belongs in the Cozy libraries
source repository and should be consumed as a published or linked package.

After that:

1. Remove `cozy-harvest-lib` from `package.json`.
2. Regenerate `yarn.lock`.
3. Run the targeted tests and the full test suite.
4. Run lint and a production build.
5. Review remaining `konnector`, `connector`, and `harvest` references.

## Validation already run

- Targeted qualification and Drive tests: passed.
- ESLint on changed JavaScript/TypeScript files: passed.
- `git diff --check`: passed.
