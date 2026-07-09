# Codebase Concerns

**Analysis Date:** 2026-02-26

## Tech Debt

**Query Duplication:**
- Issue: Multiple similar query builders that are nearly identical implementations (`buildRecentQuery`, `buildRecentWithMetadataAttributeQuery`, `buildSharingsQuery`, `buildSharingsWithMetadataAttributeQuery`, `buildDriveQuery`, `buildFileWithSpecificMetadataAttributeQuery`). These should be refactored to reduce code duplication.
- Files: `src/queries/index.ts` (lines 114-117, 178-180, 317-319)
- Impact: Maintenance burden, increased likelihood of divergent behavior, harder to apply fixes consistently
- Fix approach: Create parameterized query builder utilities that accept metadata attributes and return appropriate query configurations. Consolidate `buildRecentQuery` variants and `buildSharingsQuery` variants.

**Redux State for Upload Module:**
- Issue: Upload state is persisted in global Redux store instead of local component state
- Files: `src/store/rootReducer.js` (line 9), `src/modules/upload/index.js`
- Impact: Tightly couples upload logic to Redux, makes testing harder, increases global state complexity
- Fix approach: Migrate upload state to React Context or local component state; use Redux only for persistent application preferences

**State Migration Boilerplate:**
- Issue: Legacy state migration logic using `hasOwnProperty` check for settings that should have been removed post version 1.8.1
- Files: `src/store/persistedState.js` (lines 5-37)
- Impact: Dead code path, confusion about state structure, accumulation of technical debt
- Fix approach: Remove migration logic in next major version bump; add deprecation warning in v2

**Lack of Web Worker for Encryption:**
- Issue: File encryption operations run on main thread instead of in a web worker
- Files: `src/modules/upload/index.js` (line 426)
- Impact: Blocks UI during encryption of large files, poor user experience with large uploads
- Fix approach: Implement web worker for `encryptAndUploadNewFile()` operation

**Fragile extraColumns Prop Passing:**
- Issue: `extraColumns` prop is manually passed through multiple component layers (FolderViewBody → FileListHeader → File) making it easy to forget updates
- Files: `src/modules/views/Folder/FolderViewBody.jsx` (lines 50-52)
- Impact: Column display inconsistencies when updates are missed in any component layer
- Fix approach: Use React Context for `extraColumns` or centralize in component composition

**Suboptimal File Query Workaround:**
- Issue: `buildFileWhereByIdQuery()` uses `where` instead of `getById` to work around server limitation where path is not returned with `getById`
- Files: `src/queries/index.ts` (lines 372-383)
- Impact: Works around backend limitation; if server is fixed, this becomes inefficient query
- Fix approach: Monitor cozy-stack updates for path inclusion in `getById` responses; create helper to abstract this workaround

**Cache Disabled on Sharings Query:**
- Issue: Sharings query explicitly disables cache to get the "included" part of the result
- Files: `src/queries/index.ts` (line 655)
- Impact: Extra network requests on every sharings view visit, performance impact for frequent users
- Fix approach: Investigate if caching can be partially enabled or if `included` data can be normalized in cache

**ScrollTo Hack in FolderViewBody:**
- Issue: Scroll is forcefully reset to top on every folder change instead of proper scroll restoration
- Files: `src/modules/views/Folder/FolderViewBody.jsx` (lines 80-100)
- Impact: Poor UX for users navigating deep folder hierarchies; loss of scroll position
- Fix approach: Implement proper scroll position restoration via router state or sessionStorage

**Factory Collection Usage in File Deletion:**
- Issue: File deletion goes through FileCollection.destroy() instead of direct client.destroy() due to internal store update issue
- Files: `src/modules/actions/utils.js` (lines 99-101)
- Impact: Workaround suggests underlying client state management issue; hidden complexity
- Fix approach: Investigate and fix root cause in cozy-client store synchronization

## Known Bugs

**Regression on Normal Folder Render (Recent Fix):**
- Symptoms: Folders fail to render normally (likely thumbnail display issue)
- Files: `src/modules/filelist/icons/FileThumbnail.tsx`
- Trigger: Recent change around shared drive file detection
- Workaround: Fixed in commit 55e9cd23c
- Context: Multiple shared drive detection refactors in recent commits suggest fragile area

**Shared Drive Detection Complexity:**
- Symptoms: Incorrect detection of shared drive files leading to rendering issues
- Files: Multiple recent fixes: commits 13ce4e202, e16af2ddb, 067551b7d
- Trigger: `referenced_by` entries not fully validated
- Workaround: Updated to check all entries; previous versions only checked partial
- Pattern: Recent commits show iterative fixes rather than comprehensive solution

**Nested Anchor Tags in File Components:**
- Symptoms: Nested `<a>` tags causing invalid HTML and potential accessibility issues
- Files: `src/modules/views/Recent/index.spec.jsx` (line 94), `src/modules/views/Sharings/index.spec.jsx` (line 92)
- Impact: Invalid HTML structure; screen reader behavior undefined
- Fix approach: Refactor File component to avoid wrapping links in links

**Broken Test Assertions on Recent/Sharings Views:**
- Symptoms: Multiple TODO comments about fixing tests for these views
- Files: `src/modules/views/Recent/index.spec.jsx` (line 96), `src/modules/views/Sharings/index.spec.jsx` (line 125), `src/modules/views/Public/PublicFolderView.spec.jsx` (line 146)
- Issue: Reference to GitHub issue #2913 suggests known structural problem
- Priority: High - indicates test infrastructure issues

## Security Considerations

**Unvalidated File Metadata in Cozy Metadata:**
- Risk: `cozyMetadata.createdOn` used without validation in shared drive operations
- Files: `src/modules/paste/index.js` (lines 39, 47)
- Current mitigation: Assumed to come from trusted Cozy stack
- Recommendations: Add runtime validation of `createdOn` format before using in API calls

**Missing Error Boundary for Encryption:**
- Risk: Encryption failures during upload are not wrapped in try-catch at upload level
- Files: `src/modules/upload/index.js` (lines 423-440)
- Current mitigation: VaultClient presumably handles errors internally
- Recommendations: Add explicit error handling for encryption operations

**File Path Traversal Potential:**
- Risk: File operations accept user-provided paths without obvious validation
- Files: `src/modules/paste/index.js`, `src/modules/move/`
- Current mitigation: Server-side validation expected
- Recommendations: Add client-side path validation; document assumptions about server validation

**Environment Variables in Client Code:**
- Risk: `process.env` accessed in source code but only for `NODE_ENV` checks
- Files: `src/lib/sentry.js`, `src/lib/flags.js`, `src/targets/services/qualificationMigration.js`
- Current mitigation: No sensitive environment variables are referenced
- Recommendations: Keep environment access restricted to build/service bootstrap; avoid in application code

## Performance Bottlenecks

**Large Queries with 100 Item Limit:**
- Problem: Folder content queries hardcoded to `limitBy(100)` may cause cascading pagination loads
- Files: `src/queries/index.ts` (multiple: lines 80, 273, 303)
- Cause: Balance between API efficiency and UI responsiveness not documented
- Improvement path: Profile actual load times; consider dynamic limits based on folder size estimates

**Recent Files Query with No Apparent Limit:**
- Problem: Recent files view queries all updated files but only takes 50 items, no pagination shown
- Files: `src/queries/index.ts` (line 103)
- Cause: Arbitrary limit may miss legitimate recent files
- Improvement path: Implement infinite scroll or configurable limits

**Unoptimized Encryption Key Lookup:**
- Problem: Encryption key fetched individually per upload queue item
- Files: `src/modules/upload/index.js` (line 411)
- Cause: Keys looked up synchronously in loop
- Improvement path: Batch encryption key lookups; cache by directory

**Multiple Query Executions for Metadata Column Display:**
- Problem: Separate queries executed to check metadata existence for column display
- Files: `src/queries/index.ts` (buildRecentWithMetadataAttributeQuery, buildSharingsWithMetadataAttributeQuery, buildFileWithSpecificMetadataAttributeQuery)
- Cause: Need to check existence without loading all items
- Improvement path: Add aggregation endpoint or batch metadata queries

**Icon Picker Component Size:**
- Problem: IconIndex contains all icons inline without lazy loading
- Files: `src/components/IconPicker/IconIndex.js` (567 lines)
- Cause: Large flat list of icon definitions
- Improvement path: Implement virtual scrolling or lazy loading

## Fragile Areas

**Shared Drive Integration:**
- Files: `src/modules/shareddrives/`, `src/modules/paste/index.js`, `src/modules/views/SharedDrive/`
- Why fragile: Multiple recent bug fixes (commits 13ce4e202, 067551b7d, 3ec08e72b); complex detection logic; attribute mapping between regular and shared drive operations
- Safe modification: Add comprehensive test coverage for `isDriveBackedFile` helper and `referenced_by` checking; verify both single and multiple file operations
- Test coverage: SharedDrive-specific tests exist but recent iterations suggest gaps in detection logic

**File Upload with Encryption:**
- Files: `src/modules/upload/index.js`, `src/lib/encryption.js`
- Why fragile: Main thread blocking during encryption; async FileReader pattern; multiple error states (conflict, quota, network); encryption key lookup pattern
- Safe modification: Extract encryption logic to separate service; add comprehensive error handling for each async operation; test with large files
- Test coverage: upload/index.spec.js has 606 lines but fragmentation suggests missing edge cases

**Query Building System:**
- Files: `src/queries/index.ts` (672 lines)
- Why fragile: Highly repetitive code; slight variations between query builders; cache policy decisions scattered; workarounds embedded (buildFileWhereByIdQuery)
- Safe modification: Extract common query patterns into factory functions; document cache policy decisions; add integration tests for each query variant
- Test coverage: No dedicated test file found for queries

**File Rename + Paste Operations:**
- Files: `src/modules/paste/index.js`, `src/modules/move/MoveModal.jsx`, `src/modules/drive/RenameInput.jsx`
- Why fragile: Multiple async operations with potential race conditions; conflict resolution logic; sharing permission validation
- Safe modification: Add operation queuing; implement optimistic UI updates with rollback; test conflict scenarios thoroughly
- Test coverage: paste/index.spec.js (414 lines) exists but MoveModal (442 lines spec) suggests complexity

**FolderViewBody Component:**
- Files: `src/modules/views/Folder/FolderViewBody.jsx` (269 lines)
- Why fragile: Mixing responsibilities (rendering, sorting, selection, drag-drop); manual prop passing of extraColumns; scroll hack; two implementations (virtualized and non-virtualized)
- Safe modification: Split into smaller focused components; extract scroll logic to custom hook; use Context for extraColumns
- Test coverage: Limited test coverage for this large component

**Navigation and State Management:**
- Files: `src/modules/navigation/duck/actions.jsx` (352 lines), `src/modules/filelist/duck/`
- Why fragile: Redux store drives folder navigation; complex selectors; state shape not well documented
- Safe modification: Add migration to Context API gradually; document state shape; add TypeScript types
- Test coverage: Helpers tested (345 line spec) but action creators less documented

## Scaling Limits

**Thumbnail Loading:**
- Current capacity: 100 items per folder load
- Limit: No batch thumbnail generation; each thumbnail is individual HTTP request with 10-minute expiry
- Scaling path: Implement thumbnail batch endpoint; increase cache TTL for thumbnails; add client-side caching layer

**Shared Drive Sync:**
- Current capacity: Queries filter shared drives client-side; multiple queries per view
- Limit: Scales linearly with number of shared drives accessed
- Scaling path: Implement server-side filtering; add pagination to shared drive list; implement caching strategy

**File Upload Queue:**
- Current capacity: Serial upload processing in main thread (especially with encryption)
- Limit: Large folders with many uploads will be very slow; encryption blocks UI
- Scaling path: Implement parallel upload workers; move encryption to web worker; add upload priority queue

## Dependencies at Risk

**Outdated @swc/jest:**
- Risk: Version 0.2.37 may have unfixed bugs; newer versions potentially available
- Impact: Test execution may fail or be slow; compatibility with latest SWC parser changes
- Migration plan: Update to latest @swc/jest; verify all tests pass; test TypeScript compilation

**Redux 3.7.2 with React 18:**
- Risk: Redux version is from 2015; React 18 features (suspense, concurrent) not fully compatible
- Impact: Cannot use modern React patterns; missing performance optimizations available in React 18
- Migration plan: Migrate to React Context or Zustand incrementally; prioritize form state management first

**Worker-Loader 2.0.0:**
- Risk: Not used for encryption despite TODO comment; webpack-specific; alternatives available
- Impact: Web worker implementation blocked; dead dependency
- Migration plan: Use native Web Worker API directly or modern bundler support

**Node 2.6.7:**
- Risk: Very old version; may have security vulnerabilities
- Impact: Only used in tests/build; but indicates potential build system staleness
- Migration plan: Update to latest node-fetch or remove if not needed

## Missing Critical Features

**Web Worker for File Encryption:**
- Problem: No async encryption handling; blocks main thread on large files
- Blocks: Large file uploads; smooth user experience with encryption enabled
- Needed for: Supporting encrypted files without UI freezing

**Scroll Position Restoration:**
- Problem: Scroll forced to top on every navigation; no history integration
- Blocks: Good UX for users browsing deep folder hierarchies
- Needed for: Historical scroll position restoration per route

**Batch Operations Optimization:**
- Problem: Single operations repeated in loops instead of batch API calls
- Blocks: Efficient multi-file operations; performance on folders with many files
- Needed for: Reasonable performance on bulk operations (move, copy, trash)

**Metadata Aggregation Query:**
- Problem: Separate queries to check if any file has a metadata attribute
- Blocks: Efficient column display decision without full data load
- Needed for: Sub-100ms metadata column decision queries

## Test Coverage Gaps

**Query Builder Coverage:**
- What's not tested: Query definitions for all variants (buildRecentQuery, buildSharingsQuery, buildDriveQuery, buildFileWithSpecificMetadataAttributeQuery, etc.)
- Files: `src/queries/index.ts` (no dedicated test file found)
- Risk: Query variations diverge silently; cache policies not validated; filter logic not verified
- Priority: High - queries are critical infrastructure

**Shared Drive File Operations:**
- What's not tested: Complete shared drive move/copy workflows; detection of shared drive backed files; `referenced_by` validation edge cases
- Files: `src/modules/shareddrives/`, `src/modules/paste/index.js`
- Risk: Recent bug fixes suggest missing edge cases; regressions likely
- Priority: High - recent commits show active fragility

**Encryption Integration:**
- What's not tested: End-to-end encryption workflows; FileReader callbacks; error handling during encryption; large file encryption performance
- Files: `src/lib/encryption.js`, `src/modules/upload/index.js` encryption section
- Risk: Silent failures in encryption; no feedback to user if encryption fails
- Priority: High - affects data security

**Paste Operation Conflict Resolution:**
- What's not tested: All conflict scenarios (same name, permissions, encrypted source→unencrypted dest, etc.); rollback behavior; concurrent operations
- Files: `src/modules/paste/index.js`, `src/modules/paste/utils.spec.js` (287 lines suggests partial coverage)
- Risk: Data corruption or loss on conflict; incorrect permission inheritance
- Priority: High - critical operation

**FolderViewBody Component Edge Cases:**
- What's not tested: Large folder rendering (1000+ items); scroll position on pagination; selection with virtualization; keyboard shortcuts with large datasets
- Files: `src/modules/views/Folder/FolderViewBody.jsx` (no dedicated spec found), virtualized version has some tests
- Risk: Performance degradation; UI bugs with large datasets
- Priority: Medium - affects core navigation

**Error Boundary Integration:**
- What's not tested: Component error boundaries; recovery from encryption errors; network error resilience
- Files: Various service layers (`src/modules/actions/utils.js`, `src/modules/upload/index.js`)
- Risk: Unhandled errors crash components; poor error recovery
- Priority: Medium - affects stability

---

*Concerns audit: 2026-02-26*
