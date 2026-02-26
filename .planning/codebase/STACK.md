# Technology Stack

**Analysis Date:** 2026-02-26

## Languages

**Primary:**
- JavaScript (ES6+) - Runtime language, used throughout the application
- TypeScript 4.9.5 - Type checking for React components and utilities
- JSX/TSX - React component definitions

**Secondary:**
- Stylus - Styling with `stylus-config-cozy-app`

## Runtime

**Environment:**
- Node.js 20 (specified in `.nvmrc`)

**Package Manager:**
- Yarn - Official package manager
- Lockfile: `yarn.lock` present (634920 bytes)

## Frameworks

**Core:**
- React 18.2.0 - UI framework
- React DOM 18.2.0 - DOM rendering
- React Router DOM 6.14.2 - Client-side routing with hash-based navigation

**State Management:**
- Redux 3.7.2 - Application state management
- React-Redux 7.2.0 - Redux bindings for React
- Redux-Thunk 2.4.2 - Middleware for async actions
- Redux-Logger 3.0.6 - Redux debugging middleware

**UI & Styling:**
- Cozy UI 135.8.0 - Design system components
- Cozy UI Plus 4.4.1 - Extended UI components
- Classnames 2.3.1 - Conditional CSS class management

**Data Management:**
- Cozy Client 60.20.0 - HTTP client and data state management for Cozy API
- Cozy Stack Client 60.19.0 - Cozy stack protocol client
- Cozy PouchLink 60.19.0 - PouchDB integration for offline data sync
- Cozy DataProxy Lib 4.13.0 - Data proxy support for offline queries

**Additional Libraries:**
- React DnD 16.0.1 - Drag and drop functionality
- React DnD HTML5 Backend 16.0.1 - HTML5 drag/drop backend
- React Dropzone 14.3.8 - File upload handling
- React Autosuggest 10.1.0 - Autocomplete search
- React PDF 5.7.2 - PDF viewing capability
- React Selecto 1.26.3 - DOM element selection
- React Inspector 5.1.1 - React component tree inspection (dev)
- Leaflet 1.9.4 - Map library (for location/geo features)
- LocalForage 1.10.0 - Browser storage abstraction (IndexedDB, localStorage fallback)

**Internationalization:**
- Twake I18N 0.3.0 - i18n library for multi-language support
- Node-Polyglot 2.4.2 - Pluralization and translation management

**Cozy Ecosystem:**
- Cozy Bar 29.3.0 - Application header bar and navigation
- Cozy Sharing 28.4.0 - Document sharing implementation
- Cozy Viewer 26.6.4 - File viewer component
- Cozy Intent 2.30.1 - Inter-app communication via intents
- Cozy Interapp 0.15.1 - Inter-app communication
- Cozy Realtime 5.8.0 - WebSocket-based real-time updates
- Cozy Flags 4.6.1 - Feature flags management
- Cozy Harvest Lib 36.0.4 - Account/service connector management
- Cozy Keys Lib 7.0.0 - Encryption key management
- Cozy Minilog 3.9.1 - Lightweight logging
- Cozy Logger 1.17.0 - Service logging
- Cozy Device Helper 4.0.1 - Device platform detection
- Cozy DevTools 1.2.1 - Development utilities
- Cozy DocTypes 1.85.4 - Document type schemas

**Utilities:**
- Date-fns 2.30.0 - Date manipulation and formatting
- Diacritics 1.3.0 - Remove accents from strings
- Filesize 10.1.6 - Human-readable file size formatting
- Lodash 4.17.21 - Utility function library
- MIME Types 2.1.35 - MIME type identification
- Node-Fetch 2.6.7 - HTTP client (isomorphic)
- Whatwg-Fetch 3.0.0 - Fetch polyfill
- Prop-Types 15.8.1 - Runtime prop validation
- React Remove Scroll 2.4.4 - Manage body scroll with modals

## Build & Development

**Bundler:**
- Rsbuild 1.5.15 - Modern build tool based on Rspack
- Rspack (underlying) - Rust-based bundler
- SWC 1.10.7 - Rust-based JavaScript compiler

**Build Configuration:**
- `rsbuild.config.mjs` - Main build configuration
- `rsbuild-config-cozy-app` 0.7.1 - Cozy-specific build presets
- Babel 7.23.3+ - JavaScript transpilation
- Babel preset `babel-preset-cozy-app` 2.1.0 - Cozy preset

**Development:**
- Hot Module Replacement (HMR) - For fast development iteration
- Watch mode with polling (`watchOptions.poll`)

## Testing

**Framework:**
- Jest 29.7.0 - Test runner
- Jest Environment JSDOM 29.7.0 - Browser-like test environment
- SWC Jest 0.2.37 - Jest integration with SWC
- Babel Jest 29.7.0 - Babel transpilation for tests

**Testing Libraries:**
- Testing Library React 14.3.1 - React component testing
- Testing Library React Hooks 8.0.1 - React hooks testing
- Testing Library Jest DOM 5.17.0 - DOM assertions
- React Test Renderer 18.2.0 - Component snapshot testing

**Mocking & Utilities:**
- Redux Mock Store 1.5.4 - Mock Redux store for testing
- Mock Date 3.0.5 - Date mocking for time-dependent tests
- Identity Obj Proxy 3.0.0 - CSS module mocking
- Why Did You Render 10.0.1 - React performance debugging

## Linting & Code Quality

**Linters:**
- ESLint 8.56.0 - JavaScript linter
- TypeScript ESLint Parser 5.62.0 - TypeScript parsing
- TypeScript ESLint Plugin 5.62.0 - TypeScript-specific rules
- Stylint 1.5.9 - Stylus linter

**ESLint Plugins:**
- eslint-config-cozy-app 6.1.0 - Cozy preset
- eslint-plugin-react 7.33.2 - React rules
- eslint-plugin-react-hooks 4.6.0 - React hooks rules
- eslint-plugin-import 2.29.1 - Import/export validation
- eslint-plugin-jest 27.6.0 - Jest-specific rules
- eslint-plugin-promise 6.1.1 - Promise handling
- eslint-plugin-prettier 4.2.1 - Prettier integration

**Code Formatter:**
- Prettier 2.8.8 - Code formatting
- Configuration: `.prettierrc` (minimal config)

**TypeScript:**
- TypeScript 4.9.5 - Type checking
- cozy-tsconfig 1.8.1 - Shared TypeScript configuration

## Error Tracking & Monitoring

**Error Reporting:**
- Sentry (@sentry/react 7.119.0) - Error tracking and performance monitoring
  - DSN: `https://05f3392b39bb4504a179c95aa5b0e8f6@errors.cozycloud.cc/41`
  - Integrations: React Router v6 Browser Tracing, Console Integration
  - Trace Sample Rate: 0.1 (10% sampling)
  - Console error capture enabled for error logging

## Publishing & Deployment

**App Publishing:**
- cozy-app-publish 0.40.1 - Publish to Cozy registries
  - Pre-publish hook: `downcloud`
  - Post-publish hook: `mattermost`
- cozy-jobs-cli 2.4.3 - Job/service CLI management

**Build Analysis:**
- Bundlemon 3.1.0 - Bundle size monitoring
- Configuration: `.bundlemonrc`

## Configuration Files

**Build:**
- `rsbuild.config.mjs` - Main build configuration with Cozy app presets
- `tsconfig.json` - TypeScript compiler options with @ path alias for src/
- `jest.config.js` - Jest test runner configuration with module name mappings
- `.eslintrc.json` - ESLint configuration extending cozy-app/react preset
- `.prettierrc` - Prettier configuration (minimal)
- `babel.config.js` - Babel configuration

**Project Metadata:**
- `manifest.webapp` - Cozy app manifest defining routes, permissions, intents, services
- `package.json` - Project dependencies and scripts
- `.nvmrc` - Node version specification (v20)

**i18n & Localization:**
- `.transifexrc.tpl` - Transifex configuration template
- `transifex.yml` - Transifex integration for translation management
- `.tx/` - Transifex CLI configuration

**Publishing & Monitoring:**
- `renovate.json` - Dependency update automation configuration
- `.bundlemonrc` - Bundle size tracking

## Manifest & Permissions

**Application Routes:**
- `/` - Main drive application
- `/intents` - Intent handling for file operations
- `/public` - Public link viewing
- `/preview` - Document preview

**Services:**
- `qualificationMigration` - File qualification migration service (Node.js)
- `dacc` - Data collection service (Node.js, monthly trigger)

---

*Stack analysis: 2026-02-26*
