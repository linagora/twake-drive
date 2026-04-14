import PropTypes from 'prop-types'
import React, { useEffect } from 'react'

import { ERROR_MISSING_PARAMS, ERROR_UNKNOWN_ACTION } from './constants'
import { capabilityHandlers } from './handlers'
import { isActionDeclared } from './manifest'
import { postError } from './protocol/postResultToParent'

/**
 * Top-level router for the OpenBuro capabilities target. Dispatches the URL
 * action segment to the matching handler from the registry.
 *
 * Routing is gated by the published OpenBuro manifest (see ./manifest.js):
 * any action that is not declared there is refused, even if a handler
 * happens to exist in the registry. The manifest is the public contract —
 * if we accept something we didn't advertise, clients cannot trust what
 * they discover via /openburo.json.
 *
 * When params cannot be parsed (`{error: 'missing-params'}` from parseParams),
 * we render a static error message and do not postMessage — we do not know
 * where to send anything.
 */
const CapabilityRouter = ({ action, params }) => {
  const missingParams = params && params.error === ERROR_MISSING_PARAMS
  const declared = isActionDeclared(action)
  const Handler = declared ? capabilityHandlers[action] : null

  useEffect(() => {
    if (missingParams) return
    if (!declared || !Handler) {
      postError({
        clientUrl: params.clientUrl,
        id: params.id,
        message: ERROR_UNKNOWN_ACTION
      })
    }
  }, [declared, Handler, missingParams, params])

  if (missingParams) {
    return (
      <div role="alert">Missing required OpenBuro params (clientUrl, id).</div>
    )
  }

  if (!declared || !Handler) return null

  return <Handler params={params} />
}

CapabilityRouter.propTypes = {
  action: PropTypes.string,
  params: PropTypes.object.isRequired
}

export default CapabilityRouter
