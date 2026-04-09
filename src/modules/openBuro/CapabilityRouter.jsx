import PropTypes from 'prop-types'
import React, { useEffect } from 'react'

import { ERROR_UNKNOWN_ACTION } from './constants'
import { capabilityHandlers } from './handlers'
import { postError } from './protocol/postResultToParent'

/**
 * Top-level router for the OpenBuro capabilities target. Dispatches the URL
 * action segment to the matching handler from the registry.
 *
 * When params cannot be parsed (`{error: 'missing-params'}` from parseParams),
 * we render a static error message and do not postMessage — we do not know
 * where to send anything.
 */
const CapabilityRouter = ({ action, params }) => {
  const missingParams = params && params.error === 'missing-params'
  const Handler = capabilityHandlers[action]

  useEffect(() => {
    if (missingParams) return
    if (!Handler) {
      postError({
        clientUrl: params.clientUrl,
        id: params.id,
        message: ERROR_UNKNOWN_ACTION
      })
    }
  }, [Handler, missingParams, params])

  if (missingParams) {
    return (
      <div role="alert">Missing required OpenBuro params (clientUrl, id).</div>
    )
  }

  if (!Handler) return null

  return <Handler params={params} />
}

CapabilityRouter.propTypes = {
  action: PropTypes.string,
  params: PropTypes.object.isRequired
}

export default CapabilityRouter
