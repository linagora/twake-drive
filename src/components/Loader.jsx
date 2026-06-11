import React from 'react'

import Spinner from 'cozy-ui/transpiled/react/Spinner'

/**
 * Centered, full-height loading spinner shared by the full-screen editor views
 * (PDF, Excalidraw).
 */
const Loader = () => (
  <div className="u-flex u-flex-items-center u-flex-justify-center u-flex-grow-1">
    <Spinner size="xxlarge" />
  </div>
)

export default Loader
