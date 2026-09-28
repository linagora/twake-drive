import * as Sentry from '@sentry/react'
import { createElement, useEffect } from 'react'
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

// withSentryReactRouterV6Routing reads module state that
// reactRouterV6BrowserTracingIntegration only fills during Sentry.init, and
// returns the plain Routes when it is missing. Wrapping at import time would
// bind the unwrapped Routes for good, since this module is imported before
// initSentry runs. Wrapping on first render happens after it.
let wrappedRoutes = null

export const SentryRoutes = props => {
  if (!wrappedRoutes) {
    wrappedRoutes = Sentry.withSentryReactRouterV6Routing(Routes)
  }
  return createElement(wrappedRoutes, props)
}
