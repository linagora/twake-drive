# External Integrations

**Analysis Date:** 2026-02-26

## APIs & External Services

**Cozy Stack (Primary Backend):**
- Service: Cozy Cloud stack
- What it's used for: File storage, user authentication, document management, file operations (CRUD)
- SDK/Client: `cozy-client` (60.20.0) and `cozy-stack-client` (60.19.0)
- Authentication: Token-based (passed from Cozy server via `data.token`)
- Connection: HTTP/HTTPS via `cozyUrl` constructed from domain (`window.location.protocol` + `data.domain`)
- Implementation: `src/targets/browser/setupAppContext.js`, `src/targets/public/index.jsx`

**File Collections API:**
- DocType: `io.cozy.files`
- Usage: File management, folder operations, file metadata, permissions
- Implementation: Throughout `src/queries/index.ts` and various components
- Key operations: List, create, update, delete files/folders

**Sharing API:**
- DocType: `io.cozy.sharings`
- Usage: Document sharing management, share link creation
- SDK: `cozy-sharing` (28.4.0)
- Implementation: `src/modules/shareddrives/` and sharing-related components

**Realtime Updates:**
- Service: Cozy realtime WebSocket service
- What it's used for: Live file updates, real-time notifications of changes
- SDK/Client: `cozy-realtime` (5.8.0)
- Plugin registration: `src/lib/registerClientPlugins.js`
- Implementation: `src/components/FilesRealTimeQueries.jsx` - Buffers and debounces realtime events
- Channel subscription: File and doctype change events

**Feature Flags:**
- Service: Cozy flags service
- What it's used for: Feature toggles (drive.logger, debug, dataproxy.queries.enabled, drive.office.enabled, etc.)
- SDK/Client: `cozy-flags` (4.6.1)
- Implementation: `src/lib/flags.js`, used throughout via `flag()` function
- Key flags: office functionality, nextcloud integration, wallpaper personalization

**Data Proxy:**
- Service: Data proxy for offline query support
- What it's used for: Offline data querying when dataproxy flag is enabled
- SDK/Client: `cozy-dataproxy-lib` (4.13.0)
- Link: `DataProxyLink` - Added conditionally in setupAppContext based on feature flag
- Implementation: `src/targets/browser/setupAppContext.js`

**OnlyOffice Integration:**
- Service: OnlyOffice document editor
- What it's used for: Creating and editing documents (text, spreadsheet, presentation)
- Usage: Entrypoints defined in manifest for creating new files
- Conditions: Feature flag `drive.office.enabled`, `drive.office.write`, `bar.onlyoffice.enabled`
- Assets: `src/assets/onlyOffice/` (copied to build)
- Routes: `/onlyoffice/create/{drive-id}/{document-type}`

**Nextcloud Integration:**
- Service: Nextcloud remote file access
- What it's used for: Accessing files on Nextcloud instances
- DocType: `io.cozy.remote.nextcloud.files`
- Usage: File picker and folder views support Nextcloud sources
- Components: `FolderPickerContentNextcloud.tsx`, Nextcloud views in modules
- Flag: `drive.hide-nextcloud-dev` for disabling in dev

**Leaflet Maps:**
- Service: Leaflet mapping library
- What it's used for: Map display/visualization for file locations
- Package: `leaflet` (1.9.4)
- Likely usage: GEO or location-based file features (integrated but not primary)

## Data Storage

**Databases:**
- **Primary:** Cozy Stack database (remote)
  - Connection: Via Cozy Client HTTP protocol
  - Client: `cozy-stack-client`
  - DocTypes managed: io.cozy.files, io.cozy.sharings, io.cozy.contacts, io.cozy.albums, etc.

- **Offline/Local:** PouchDB (via cozy-pouch-link)
  - Package: `cozy-pouch-link` (60.19.0)
  - Purpose: Local replication and offline sync
  - Enabled: Via `StackLink` configuration
  - Schema registration: `src/lib/doctypes.ts`

**Browser Storage:**
- **IndexedDB / LocalStorage:** LocalForage
  - Package: `localforage` (1.10.0)
  - Usage: User preferences, state persistence, feature flags state
  - Implementation: `src/store/persistedState.js` (Redux state persistence)
  - Used by: PushBanner, CallToAction, desktop client notifications
  - Key implementations:
    - `src/store/persistedState.js` - Persists Redux state
    - `src/components/pushClient/Banner.jsx` - Desktop banner dismissal state
    - `src/modules/viewer/CallToAction.jsx` - Call-to-action dismissal state

**File Upload Handling:**
- Package: `react-dropzone` (14.3.8)
- Purpose: Drag-and-drop and file selection for uploads
- Implementation: Upload module in `src/modules/upload/`

## Authentication & Identity

**Auth Provider:**
- Service: Cozy Stack (built-in)
- Implementation: Custom token-based authentication
- Flow: Token provided by Cozy server via `data.token` in DOM dataset
- Setup: `src/targets/browser/setupAppContext.js` - token passed to CozyClient constructor
- Public sharing: Share codes via query parameters (`sharecode` in public views)

**Contact Management:**
- Service: Cozy Contacts database
- DocType: `io.cozy.contacts`, `io.cozy.contacts.groups`
- Purpose: Contact information for sharing and collaboration
- Permissions: GET, POST for contacts; GET for groups

**OAuth Clients:**
- DocType: `io.cozy.oauth.clients`
- Purpose: OAuth application registration (for desktop sync client)
- Usage: Display desktop client banner when OAuth app exists

## Monitoring & Observability

**Error Tracking:**
- Service: Sentry
- DSN: `https://05f3392b39bb4504a179c95aa5b0e8f6@errors.cozycloud.cc/41`
- Package: `@sentry/react` (7.119.0)
- Integrations:
  - React Router v6 Browser Tracing
  - Console Integration (captures console.error only)
  - Performance monitoring with 10% trace sample rate
- Implementation: `src/lib/sentry.js`
- Middleware: Used in `src/targets/public/components/AppRouter.jsx` (SentryRoutes wrapper)
- Release tracking: Automatic based on package.json version
- Environment: Tracks NODE_ENV

**Logging:**
- **Client-side:** Console logging + Sentry
- **Service-side:** `cozy-logger` (1.17.0) for backend jobs/services
  - Used in: `src/lib/dacc/dacc.js`, `src/lib/migration/qualification.js`
- **Redux Logging:** `redux-logger` (3.0.6) - conditional based on `drive.logger` flag
- **Cozy Minilog:** `cozy-minilog` (3.9.1) - lightweight logging infrastructure

## CI/CD & Deployment

**Hosting:**
- Platform: Cozy Cloud platform (self-hosted)
- Deployment target: Twake Workplace (cozy-drive branded as Twake Drive)

**CI Pipeline:**
- Service: GitHub Actions (`.github/workflows/ci-cd.yml`)
- Stages:
  1. Lint (ESLint + Stylint)
  2. Test (Jest)
  3. Build (Rsbuild)
  4. BundleMon (bundle size tracking)
  5. Publish (Cozy app registry)
- Publishing: `yarn cozyPublish` via `cozy-app-publish`
  - Pre-publish hook: `downcloud` (SSH deployment)
  - Post-publish hook: `mattermost` (notification)

**Version Control:**
- Tags: Semantic versioning (e.g., `1.91.0`, `1.91.0-beta.1`)
- Branches: master (production) and feature branches
- SSH deployment: Via downcloud (DOWNCLOUD_SSH_KEY secret)

## Environment Configuration

**Required env vars (Runtime):**
- `NODE_ENV` - Environment (test, development, production)
- Not configured via .env - Uses Cozy platform's data injection via DOM dataset

**Secrets location:**
- GitHub Actions Secrets:
  - `REGISTRY_TOKEN` - Cozy registry publishing token
  - `MATTERMOST_HOOK_URL` - Notification webhook
  - `DOWNCLOUD_SSH_KEY` - SSH key for deployment

**Build-time Configuration:**
- Via DOM `data-cozy` attribute (injected by Cozy server):
  - `domain` - Cozy instance domain
  - `token` - Authentication token
  - `locale` - User language preference
- Via feature flags (`cozy-flags`) - Retrieved from Cozy stack at runtime

## Webhooks & Callbacks

**Incoming:**
- Share endpoints (via `cozy-sharing`)
- Intent handling (via `cozy-intent`) - OPEN actions for files and suggestions
- Public sharing callbacks - Share code validation

**Outgoing:**
- Sentry error reporting - Error events sent to Sentry
- Mattermost notifications - Post-publish deployment status

## Data Doctypes & Models

**Core Doctypes:**
- `io.cozy.files` - Files and folders
- `io.cozy.files.encryption` - File encryption metadata
- `io.cozy.sharings` - Sharing relationships
- `io.cozy.contacts` - User contacts
- `io.cozy.contacts.groups` - Contact groups
- `io.cozy.albums` - Photo albums
- `io.cozy.apps` - Application registry
- `io.cozy.settings` - User settings
- `io.cozy.accounts` - External service accounts
- `io.cozy.konnectors` - Data connector/harvester configuration
- `io.cozy.jobs` - Job/service execution logs
- `io.cozy.triggers` - Job/service triggers
- `io.cozy.drive.settings` - Drive-specific settings

**Custom/Remote Doctypes:**
- `io.cozy.remote.nextcloud.files` - Nextcloud file metadata
- `cc.cozycloud.dacc_v2` - Data anonymization reporting (CC instance)
- `eu.mycozy.dacc_v2` - Data anonymization reporting (EU instance)
- `io.cozy.ai.chat.conversations` - Chat conversation history
- `io.cozy.ai.chat.events` - Chat events

## Inter-App Communication

**Cozy Intent System:**
- Service: `cozy-intent` (2.30.1)
- Routes: `/intents` (intent handling route)
- Intents supported:
  - `OPEN` action for `io.cozy.files` - Open file from other apps
  - `OPEN` action for `io.cozy.suggestions` - Handle suggestions
- Usage: Opening files from other Twake applications

**Inter-App Bridge:**
- Service: `cozy-interapp` (0.15.1)
- Purpose: Direct communication between Cozy applications

---

*Integration audit: 2026-02-26*
