# Codebase Structure

**Analysis Date:** 2026-02-26

## Directory Layout

```
cozy-drive/
├── .github/                # CI/CD workflows (GitHub Actions)
├── .planning/              # GSD planning documents and analysis
│   └── codebase/          # Generated architecture/conventions docs
├── public/                 # Static assets for public sharing
├── src/
│   ├── assets/            # SVG icons, favicons, OnlyOffice assets
│   ├── components/        # Reusable UI components and app wrappers
│   ├── config/            # Application configuration (sort, constants)
│   ├── constants/         # Global constants (folder IDs, routes, etc.)
│   ├── contexts/          # React Context providers
│   ├── hooks/             # Custom React hooks
│   ├── lib/               # Utility functions, helpers, libraries
│   ├── locales/           # Internationalization (i18n) strings
│   ├── models/            # TypeScript interfaces and types
│   ├── modules/           # Feature modules (drive, upload, filelist, etc.)
│   ├── queries/           # CozyClient query builders
│   ├── store/             # Redux store configuration
│   ├── styles/            # Global stylus styles
│   ├── targets/           # Platform-specific entry points
│   └── declarations.d.ts  # TypeScript global declarations
├── test/                  # Test utilities and helpers
├── package.json           # Project dependencies and scripts
├── rsbuild.config.mjs     # Rsbuild bundler configuration
├── tsconfig.json          # TypeScript configuration
└── manifest.webapp        # Cozy app manifest

```

## Directory Purposes

**src/assets:**
- Purpose: Static assets bundled with the app
- Contains: Icons (SVG), favicon files, OnlyOffice configuration
- Key files: `src/assets/icons/`, `src/assets/favicons/`, `src/assets/onlyOffice/`

**src/components:**
- Purpose: Shared UI components and root app wrapper
- Contains: App.jsx (root component), reusable UI components, modals, banners
- Key files: `src/components/App/App.jsx`, `src/components/FileHistory/index.jsx`, `src/components/MoveValidationModals/index.tsx`

**src/config:**
- Purpose: Application-wide configuration
- Contains: Sort preferences, constants for views
- Key files: `src/config/sort.js`

**src/constants:**
- Purpose: Global application constants
- Contains: Folder IDs, route paths, settings
- Key files: `src/constants/config.js` (ROOT_DIR_ID, TRASH_DIR_ID, SHARED_DRIVES_DIR_ID, etc.)

**src/contexts:**
- Purpose: React Context providers for shared state
- Contains: ClipboardProvider, other context definitions
- Key files: `src/contexts/ClipboardProvider.jsx`

**src/hooks:**
- Purpose: Custom React hooks for data access and side effects
- Contains: Folder/file navigation hooks, sorting hooks, keyboard shortcuts
- Key files: `src/hooks/useCurrentFolderId.js`, `src/hooks/useDisplayedFolder.js`, `src/hooks/useFolderSort/index.ts`

**src/lib:**
- Purpose: Utility functions and helper libraries
- Contains: Doctypes schema, encryption helpers, search, path utilities
- Key files: `src/lib/doctypes.js`, `src/lib/DriveProvider.jsx`, `src/lib/ModalContext.tsx`, `src/lib/FuzzyPathSearch.js`

**src/locales:**
- Purpose: Internationalization strings
- Contains: Language files (translated strings)
- Key files: `src/locales/index.js`

**src/models:**
- Purpose: TypeScript type definitions and interfaces
- Contains: Type definitions for app-specific models
- Key files: `src/models/index.js`

**src/modules:**
- Purpose: Feature-specific modules with isolated logic
- Contains: Feature folders (see module breakdown below)
- Key modules: `drive`, `upload`, `filelist`, `actions`, `navigation`, `views`, `move`, etc.

**src/queries:**
- Purpose: CozyClient query builders with caching policies
- Contains: Query definitions for all doctypes (files, sharings, trash, etc.)
- Key files: `src/queries/index.ts` (all query builders)

**src/store:**
- Purpose: Redux store configuration and root reducer
- Contains: Store setup, middleware configuration, reducer composition
- Key files: `src/store/configureStore.js`, `src/store/rootReducer.js`

**src/styles:**
- Purpose: Global application styles
- Contains: Stylus stylesheets
- Key files: `src/styles/main.styl`

**src/targets:**
- Purpose: Platform-specific entry points and setup
- Contains: Browser app, public sharing, services, intents
- Key files: `src/targets/browser/index.jsx`, `src/targets/browser/setupAppContext.js`

**test:**
- Purpose: Test utilities and fixtures
- Contains: Test helpers, mock implementations
- Key files: `test/helpers/`, `test/jestLib/`

## Key File Locations

**Entry Points:**
- `src/targets/browser/index.jsx` - Browser app initialization
- `src/targets/browser/setupAppContext.js` - CozyClient and Redux setup
- `src/targets/public/index.jsx` - Public link sharing entry point
- `src/targets/intents/index.jsx` - Intents (inter-app communication) entry point

**Configuration:**
- `tsconfig.json` - TypeScript compiler options with path aliases (`@/*` → `./src/*`)
- `rsbuild.config.mjs` - Rsbuild bundler configuration
- `package.json` - Dependencies and build scripts
- `manifest.webapp` - Cozy app manifest (permissions, metadata)

**Core Logic:**
- `src/store/configureStore.js` - Redux store creation
- `src/store/rootReducer.js` - Root reducer composition
- `src/queries/index.ts` - All CozyClient query builders
- `src/lib/doctypes.js` - Doctype schema definitions
- `src/lib/appMetadata.js` - App metadata for CozyClient

**Routing:**
- `src/modules/navigation/AppRoute.jsx` - All application routes
- `src/modules/layout/Layout.jsx` - Main layout wrapper with sidebar/header
- `src/modules/navigation/Index.jsx` - Home/index page

**Testing:**
- `test/helpers/` - Test utility functions
- `test/jestLib/` - Jest setup and configuration

## Naming Conventions

**Files:**
- Components: PascalCase (e.g., `DriveFolderView.jsx`, `FileHistory/index.jsx`)
- Utilities/hooks: camelCase (e.g., `useFolderSort/index.ts`, `buildDriveQuery.js`)
- Tests: Same name as source with `.spec.js` or `.spec.jsx` suffix
- Styles: `.styl` (Stylus) or `.css` depending on location

**Directories:**
- Components: PascalCase (`FolderView`, `FileHistory`, `MoveValidationModals`)
- Features/modules: lowercase (`drive`, `upload`, `filelist`, `navigation`)
- Utilities: lowercase (`lib`, `hooks`, `contexts`, `queries`)

**Redux (Duck Pattern):**
- Reducer files: `duck/index.js` exports default reducer
- Action creators: `duck/actions.jsx` or inline with reducer
- Selectors: `duck/selectors.js` (if complex)

**Exports:**
- Components: Default export (e.g., `export default DriveFolderView`)
- Utilities: Named exports (e.g., `export const buildDriveQuery = ...`)
- Barrel files: Re-export from submodules (e.g., `src/hooks/index.js` re-exports all hooks)

## Where to Add New Code

**New Feature Module:**
- Primary code: `src/modules/[feature]/` (create folder with components, utils, tests)
- Main component: `src/modules/[feature]/[FeatureName].jsx` or `src/modules/[feature]/index.jsx`
- Redux (if needed): `src/modules/[feature]/duck/reducer.js`, `src/modules/[feature]/duck/actions.jsx`
- Queries (if needed): Add query builder to `src/queries/index.ts`
- Tests: Co-locate with source files using `.spec.js` suffix

**New View/Page:**
- Location: `src/modules/views/[ViewName]/[ViewName].jsx`
- Route definition: Add route to `src/modules/navigation/AppRoute.jsx`
- Toolbar actions: Create action components in `src/modules/actions/` if globally applicable
- Layout: Wrap with appropriate layout container (FolderView, Modal, etc.)

**New Reusable Component:**
- If UI-only: `src/components/[ComponentName]/index.jsx`
- If stateful/smart: `src/modules/[feature]/[ComponentName].jsx` (place in feature module)
- If modal dialog: `src/modules/views/Modal/[ModalName].jsx`
- Export via barrel: Add to `src/hooks/index.js` or component's parent index.js

**New Hook:**
- Location: `src/hooks/[hookName]/index.ts` or `src/hooks/use[HookName].ts`
- Export: Add to `src/hooks/index.js` barrel file
- If simple: Single file in hooks root
- If complex: Folder with implementation and tests

**New Utility/Helper:**
- Location: `src/lib/[utilityName].js` if global, or in relevant module folder
- Tests: `src/lib/[utilityName].spec.js`

**New Context Provider:**
- Location: `src/contexts/[ContextName]Provider.jsx` or `src/lib/[ContextName].tsx`
- Export hook: Provide `use[ContextName]()` hook alongside provider
- App-level: Add to provider chain in `src/components/App/App.jsx`

**New Query:**
- Location: Add `export const build[QueryName]Query` to `src/queries/index.ts`
- Pattern: Return `QueryConfig` with `definition` and `options`
- Caching: Use `defaultFetchPolicy` for cache timeout consistency

**New Action (File/Folder):**
- Location: `src/modules/actions/[actionName].jsx`
- Export: Via `src/modules/actions/index.js` barrel file
- Policy: Define action policy in `src/modules/actions/policies.ts`
- Usage: Pass to `makeActions()` in toolbar/menu component

**Global Styles:**
- Location: `src/styles/main.styl` or feature-specific module styles
- Import: Stylus modules imported in entry points or component files
- No SCSS/CSS preprocessor: Project uses Stylus exclusively

## Special Directories

**src/modules/views:**
- Purpose: Feature-specific view containers (pages)
- Generated: No (all hand-written)
- Committed: Yes
- Structure: Each view in its own folder (Drive, Recent, Trash, Sharings, OnlyOffice, etc.)
- Includes modal/nested views for file viewers and actions within the main view

**src/modules/actions:**
- Purpose: Reusable file/folder action definitions
- Generated: No
- Committed: Yes
- Pattern: Each action is a separate file (share.jsx, trash.jsx, rename.jsx, etc.)
- Policies: `src/modules/actions/policies.ts` defines when actions are available

**src/store:**
- Purpose: Redux store and reducer configuration
- Generated: No
- Committed: Yes
- Note: CozyClient manages its own reducer; app reducers in store/ are for app-specific state

**public/**
- Purpose: Static public folder for standalone public links
- Generated: Build-time (assets copied by Rsbuild)
- Committed: Yes
- Contains: Screenshots for screenshots feature

**build/**
- Purpose: Build output directory
- Generated: Yes (created during `yarn build` or `yarn start`)
- Committed: No (in .gitignore)
- Contains: Bundled JavaScript, CSS, assets

**node_modules/**
- Purpose: Installed dependencies
- Generated: Yes (created by `yarn install`)
- Committed: No (in .gitignore)

---

*Structure analysis: 2026-02-26*
