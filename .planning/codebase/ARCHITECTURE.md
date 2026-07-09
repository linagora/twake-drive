# Architecture

**Analysis Date:** 2026-02-26

## Pattern Overview

**Overall:** Redux-driven React SPA with cozy-client integration and modular feature structure.

**Key Characteristics:**
- Centralized Redux store with feature-based modules
- React Router v6 with feature-specific nested routes
- CozyClient as unified data layer and state management
- Context-based providers for cross-cutting concerns (modals, clipboard, FAB, etc.)
- Layered separation between views, actions, utilities, and queries

## Layers

**Views Layer:**
- Purpose: Route-based page views and containers
- Location: `src/modules/views/`, `src/modules/navigation/AppRoute.jsx`
- Contains: Feature-specific view components (Drive, Recent, Trash, Sharings, OnlyOffice, etc.)
- Depends on: Redux store, CozyClient, context providers, action creators
- Used by: React Router, main entry point

**Modules Layer:**
- Purpose: Feature-specific logic, state management, and UI components
- Location: `src/modules/`
- Contains: Feature folders (drive, upload, move, actions, filelist, selection, etc.)
- Depends on: Redux (actions/reducers), utilities, queries, contexts
- Used by: Views, other modules

**Components Layer:**
- Purpose: Reusable UI components and providers
- Location: `src/components/`
- Contains: App wrapper, Modals, Banners, FileHistory, ColorPicker, etc.
- Depends on: Contexts, hooks, cozy-ui, libraries
- Used by: Views, modules, layouts

**Contexts Layer:**
- Purpose: React Context providers for shared state across the app
- Location: `src/contexts/`, `src/lib/` (context files)
- Contains: ClipboardProvider, AcceptingSharingProvider, ModalContext, ViewSwitcherContext, etc.
- Depends on: React, utilities
- Used by: App wrapper, views, modules

**Hooks Layer:**
- Purpose: Custom React hooks for data access and side effects
- Location: `src/hooks/`
- Contains: useCurrentFolderId, useDisplayedFolder, useFolderSort, useKeyboardShortcuts, etc.
- Depends on: Redux, React, cozy-client, queries
- Used by: Views, modules, components

**State Management Layer:**
- Purpose: Redux store, reducers, and global application state
- Location: `src/store/`
- Contains: configureStore, rootReducer, persisted state configuration
- Depends on: Redux, cozy-client, thunk middleware, feature reducers
- Used by: Entire application through React-Redux provider

**Queries Layer:**
- Purpose: CozyClient query builders and definitions
- Location: `src/queries/index.ts`
- Contains: Query builders for different doctype queries (Drive, Recent, Trash, Sharings, etc.)
- Depends on: cozy-client, configuration constants
- Used by: Views, hooks, modules

**Actions Layer:**
- Purpose: File/folder action definitions and policies
- Location: `src/modules/actions/`
- Contains: Individual action files (share, trash, rename, download, etc.), action policies
- Depends on: Utilities, client, store dispatch
- Used by: View toolbars, context menus, action menus

**Utilities Layer:**
- Purpose: Helper functions and utilities
- Location: `src/lib/`, helper functions across modules
- Contains: Encryption, path helpers, logging, FuzzyPathSearch, doctypes, appMetadata, etc.
- Depends on: External libraries, types
- Used by: All layers above

## Data Flow

**File Listing Data Flow:**

1. User navigates to `/folder/:folderId` → triggers `DriveFolderView`
2. `DriveFolderView` calls `useDisplayedFolder()` hook to get current folder metadata
3. `DriveFolderView` uses `buildDriveQuery()` to construct separate queries for directories and files
4. Queries are executed via `useQuery()` hook (cozy-client), which populates Redux store
5. `useSelectionContext()` and `useShiftSelection()` manage multi-selection state
6. User actions trigger action creators from `@/modules/actions/` (share, trash, rename, etc.)
7. Action creators dispatch thunks that use CozyClient to mutate data
8. CozyClient updates Redux store, triggering component re-renders via selectors

**Modal/Navigation Data Flow:**

1. Views/components push modals via `useModalContext().pushModal()`
2. ModalContext provider renders modal stack on top of content
3. Modal receives dispatch function and can trigger Redux actions
4. Modal poppped via `popModal()` when action completes or user cancels
5. ViewSwitcherContext tracks which "view mode" is active (grid vs list, etc.)

**State Persistence:**

1. Selected folder sort preferences stored via `useFolderSort()` hook
2. Sort preferences read from/written to Redux store
3. Thumbnail size preference stored in ThumbnailSizeContext and persisted
4. Recent icons stored in localStorage via `useRecentIcons()` hook

## Key Abstractions

**Query System:**

- Purpose: Encapsulate CozyClient query definitions with caching policies
- Examples: `buildDriveQuery()`, `buildRecentQuery()`, `buildTrashQuery()` in `src/queries/index.ts`
- Pattern: Query builders return `QueryConfig` objects with definition and fetch policy options
- Enables: Query reusability, consistent caching behavior, easy modification of indexes

**Action System:**

- Purpose: Define available actions on files/folders and their policies
- Examples: `share()`, `trash()`, `rename()`, `download()` in `src/modules/actions/`
- Pattern: Action functions take `options` parameter with client, dispatch, etc.; return action object or null
- Features: Conditional action availability (via `makeActions()` from cozy-ui), policies for action visibility

**Module Pattern:**

- Purpose: Organize feature-specific code with clear boundaries
- Examples: `src/modules/drive/`, `src/modules/upload/`, `src/modules/filelist/`
- Pattern: Each module has its own folder with components, utilities, tests, and optional Redux duck
- Reduces: Circular dependencies, code coupling, makes features easier to refactor

**Context Providers:**

- Purpose: Share state across distant components without prop drilling
- Examples: `ClipboardProvider`, `ModalContextProvider`, `SelectionProvider`, `AcceptingSharingProvider`
- Pattern: Provider components wrap children and expose hooks (e.g., `useClipboardContext()`)
- Used for: Cross-cutting concerns that span multiple routes

**Hook Pattern for Data Access:**

- Purpose: Encapsulate query logic and data transformation
- Examples: `useCurrentFolderId()`, `useDisplayedFolder()`, `useFolderSort()`
- Pattern: Hooks call `useQuery()` or access Redux, optionally compute derived state
- Benefits: Reusable data access, separation of concern, easier to test

## Entry Points

**Browser Target:**

- Location: `src/targets/browser/index.jsx`
- Triggers: When app is served in browser mode (main entry point)
- Responsibilities: Load styles, initialize CozyClient, set up Redux store, mount React root

**Setup Function:**

- Location: `src/targets/browser/setupAppContext.js`
- Triggers: Called once during app initialization
- Responsibilities: Parse cozy metadata, instantiate CozyClient, register plugins, configure store, initialize translations

**App Root:**

- Location: `src/components/App/App.jsx`
- Triggers: Rendered by browser target during initialization
- Responsibilities: Set up provider hierarchy (Redux, DriveProvider, contexts), wrap routes with error boundaries

**Router:**

- Location: `src/modules/navigation/AppRoute.jsx`
- Triggers: Rendered inside App component
- Responsibilities: Define all application routes and nested route structure

**Layout:**

- Location: `src/modules/layout/Layout.jsx`
- Triggers: Renders for all authenticated routes (Layout is the root element in AppRoute)
- Responsibilities: Navigation sidebar, toolbar, overall page structure

## Error Handling

**Strategy:** Layered error handling with client-side fallbacks and Sentry integration.

**Patterns:**

- Query Failures: `foldersResult.fetchStatus === 'failed'` checked in view components; error UI shown via `<FolderView isNotFound={isNotFound} />`
- Action Failures: Action creators in `src/modules/actions/` wrap CozyClient calls in try-catch; dispatch error actions or show alerts via `useAlert()`
- Component Errors: Sentry integration via `src/lib/sentry.js` wraps routes; `<SentryRoutes>` catches and reports React errors
- Network: Online status checked via `platform.isOnline()` in `setupAppContext.js`

## Cross-Cutting Concerns

**Logging:** cozy-logger imported but minimal logging; Sentry captures errors and exceptions.

**Validation:** File metadata validation happens on server; client validation for file names (length, special chars) in `src/modules/filelist/` components.

**Authentication:** CozyClient handles auth token from app metadata; permissions checked via `useSharingContext().hasWriteAccess()` before allowing mutations.

**Encryption:** File encryption metadata included in queries via `.include(['encryption'])`; decryption handled by cozy-client VaultClient.

**Permissions:** Sharing context (cozy-sharing library) provides `byDocId` map of sharing info; view components conditionally render upload, move, delete buttons based on write access.

**Real-time Updates:** FilesRealTimeQueries component manages subscription to real-time updates; automatically updates query results when files change.

---

*Architecture analysis: 2026-02-26*
