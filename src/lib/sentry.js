import * as Sentry from '@sentry/react'
import { useEffect } from 'react'
import {
  Routes,
  useLocation,
  useNavigationType,
  createRoutesFromChildren,
  matchRoutes
} from 'react-router-dom'

import appMetadata from '@/lib/appMetadata'
import { redactEvent, redactBreadcrumb } from '@/lib/sentryScrub'

// Injected at build time, see rsbuild.config.mjs. A deployment reports to the
// collector it operates, or to none at all.
const DSN = process.env.SENTRY_DSN || null

/**
 * Starts error reporting, when the build was given a DSN.
 *
 * Only the authenticated target calls this: public pages carry the sharecode
 * in their URL and have no reason to report anywhere.
 */
export const initSentry = () => {
  if (!DSN) return

  Sentry.init({
    dsn: DSN,
    environment: process.env.NODE_ENV,
    release: appMetadata.version,
    integrations: [
      Sentry.reactRouterV6BrowserTracingIntegration({
        useEffect,
        useLocation,
        useNavigationType,
        createRoutesFromChildren,
        matchRoutes
      })
    ],
    tracesSampleRate: 0.1,
    // React log these warnings(bad Proptypes), in a console.error,
    // it is not relevant to report this type of information to Sentry
    ignoreErrors: [/^Warning: /],
    beforeSend: redactEvent,
    beforeSendTransaction: redactEvent,
    beforeBreadcrumb: redactBreadcrumb
  })
}

// A no-op wrapper around Routes until initSentry has run.
export const SentryRoutes = Sentry.withSentryReactRouterV6Routing(Routes)
