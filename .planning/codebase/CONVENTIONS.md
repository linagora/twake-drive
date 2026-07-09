# Coding Conventions

**Analysis Date:** 2026-02-26

## Naming Patterns

**Files:**
- Components: PascalCase with component descriptor (e.g., `FolderPicker.tsx`, `PushBanner.jsx`)
- Utilities: camelCase (e.g., `entries.js`, `path.js`, `encryption.js`)
- Hooks: camelCase with `use` prefix (e.g., `useRedirectLink.jsx`, `useDebounce.jsx`, `useKeyboardShortcuts.tsx`)
- Test files: Same name as source with `.spec.js`, `.spec.jsx`, `.spec.ts`, or `.spec.tsx` suffix
- Type definitions: `types.ts` for module-level types (e.g., `src/components/FolderPicker/types.ts`)

**Functions:**
- Regular functions: camelCase (e.g., `getEntriesType`, `joinPath`, `getParentPath`)
- React components: PascalCase (e.g., `FolderPicker`, `PushBanner`, `QuotaBanner`)
- Hook functions: camelCase with `use` prefix (e.g., `useRedirectLink`, `useDebounce`)
- Private/internal functions: No specific prefix, but scoped to file/module
- Handler functions: `handle` prefix (e.g., `handlePasteOperation`, `showFolderCreation`, `hideFolderCreation`)
- Getter functions: `get` prefix (e.g., `getEntriesType`, `getParentPath`, `getEncryptionKeyFromDirId`)

**Variables:**
- Local state: camelCase (e.g., `folder`, `entries`, `debouncedValue`)
- React state hooks: `[state, setState]` pattern (e.g., `[folder, setFolder]`, `[isFolderCreationDisplayed, setFolderCreationDisplayed]`)
- Boolean variables: Prefix with `is`, `should`, `can`, `has` (e.g., `isFolderCreationDisplayed`, `canCreateFolder`, `hasClipboardData`)
- Constants: UPPER_SNAKE_CASE for module-level constants (e.g., `ROOT_DIR_ID`, `SHARED_DRIVES_DIR_ID`)
- Mock data in tests: `mock` prefix (e.g., `mockClient`, `mockShowAlert`, `mockSelectedItems`)

**Types:**
- Interfaces: PascalCase (e.g., `FolderPickerProps`, `FolderPickerEntry`)
- Type aliases: PascalCase (e.g., `File`)
- Exported type definitions located in dedicated `types.ts` files per module

## Code Style

**Formatting:**
- Tool: Prettier
- Semicolons: Disabled (false) - lines end without semicolons
- Quotes: Single quotes (`'`) for string literals
- Config: `.prettierrc` at project root

**Linting:**
- Tool: ESLint 8.56.0
- Config: `.eslintrc.json` with `cozy-app/react` preset
- Key rules:
  - `no-console`: warning level (1) - console usage discouraged
  - `no-param-reassign`: error - function parameters cannot be reassigned
  - `react-hooks/exhaustive-deps`: error - all hook dependencies must be listed
  - `import/order`: warning with alphabetical sorting by group

## Import Organization

**Order (enforced by eslint-plugin-import):**
1. Built-in modules (e.g., `react`, `react-router-dom`)
2. External/npm dependencies (e.g., `cozy-client`, `classnames`)
3. Internal imports from `cozy-*` packages
4. Local imports organized by category

**Path Aliases (available):**
- `@/` → `src/`
- All ESLint path groups mapped: `test/`, `lib/`, `hooks/`, `components/`, `modules/`, `assets/`, `models/`, `config/`, `constants/`, `locales/`, `queries`

**Barrel Files:**
- Used selectively (e.g., `src/hooks/index.js` exports hook functions)
- Import from barrel files using named imports: `import { useRedirectLink } from '@/hooks'`

**Import Statement Format:**
```javascript
// Standard import
import { useCallback } from 'react'

// Namespace import for large modules
import * as Sentry from '@sentry/react'

// Named exports from local modules
import { getParentPath } from '@/lib/path'
```

## Error Handling

**Patterns:**
- Try/catch blocks used for error recovery and graceful degradation
- Errors logged with context: `logger.warn(err)` for recoverable errors, `console.error()` for critical issues
- Errors re-thrown when appropriate: `throw error` after logging to propagate failures
- Error messages include context: `Error while sending measure to remote doctype: ${error.message}`
- Sentry integration for automatic error reporting (`.src/lib/sentry.js`)
- Console errors captured by Sentry: `Sentry.captureConsoleIntegration({ levels: ['error'] })`

**Example Pattern:**
```javascript
try {
  await client.save(data)
} catch (err) {
  logger.warn(err)
  return undefined
}
```

## Logging

**Framework:** cozy-minilog configured in `src/lib/logger.js`

**Usage:**
- Import default logger: `import logger from '@/lib/logger'`
- Methods available: `logger.info()`, `logger.warn()`, `logger.log()`
- Also supports cozy-logger for structured logging: `import log from 'cozy-logger'` with `log('info', message)` format
- Console usage discouraged per ESLint rule but Sentry captures `console.error()`

**When to Log:**
- Async operations start/completion
- Error recovery attempts
- State migrations
- Configuration/flag changes
- Integration points (API calls, remote operations)

## Comments

**When to Comment:**
- Complex algorithms requiring explanation (e.g., FuzzyPathSearch scoring logic)
- Non-obvious business logic (e.g., encryption key relationships)
- Workarounds for known issues with links to issues
- Integration points with external systems
- TODO/FIXME for incomplete implementations

**JSDoc/TSDoc Usage:**
- Functions with complex behavior documented with parameter descriptions
- All exported public functions document parameters and return types
- Format:
```javascript
/**
 * Description of what function does
 * @param {Type} paramName - Description of parameter
 * @returns {Type} - Description of return value
 */
export function myFunction(paramName) {
  // implementation
}
```

**Type Comments:**
- Used in JavaScript files with `// @ts-check` at top: `src/lib/dacc/dacc.js`
- Full JSDoc typedef blocks for complex types

## Function Design

**Size:**
- Functions kept small and focused on single responsibility
- Long functions like `FuzzyPathSearch` class methods broken into smaller methods
- Handler functions typically 1-20 lines
- Utility functions typically 5-50 lines

**Parameters:**
- Named parameters preferred over positional when 3+ parameters
- Object parameters with destructuring: `{ name, dirID, driveId }`
- Optional parameters with defaults: `canCreateFolder = true`
- React components use TypeScript interfaces for props

**Return Values:**
- Early returns used to simplify control flow
- Undefined returned for missing/optional results
- Promises returned for async operations
- Arrays and objects returned for collections (never null for empty collections)

**Async/Await:**
- Used consistently for promise-based operations
- Try/catch for error handling in async functions
- `async` function prefix when returning Promises

## Module Design

**Exports:**
- Named exports for utilities and reusable functions
- Default export for React components (when single export)
- Both named and default used based on usage pattern

**Module Structure Example:**
```javascript
// src/lib/entries.js
// JSDoc for each exported function
export const getEntriesType = entries => { ... }
export const getEntriesTypeTranslated = (t, entries) => { ... }
```

**Service/Utility Modules:**
- `src/lib/` contains reusable utilities
- `src/modules/` contains feature-specific logic
- Hooks in `src/hooks/` for React-specific reusable logic
- Components in `src/components/` organized by feature

## React-Specific Conventions

**Component Structure:**
- Functional components with hooks (no class components)
- Type definitions at top: `interface ComponentProps { ... }`
- Styled components or `makeStyles()` from `cozy-ui/transpiled/react/styles`
- JSX props destructured from typed props parameter

**Hooks Usage:**
- `useState` for local state
- `useEffect` for side effects with proper dependency arrays
- Custom hooks for reusable logic (e.g., `useRedirectLink`, `useDebounce`)
- `renderHook` from `@testing-library/react-hooks` for testing hooks

**State Management:**
- Redux for global state (via `react-redux`)
- Local component state for UI-only state
- Context for cross-cutting concerns (e.g., `ClipboardContext`, `SelectionProvider`)

---

*Convention analysis: 2026-02-26*
