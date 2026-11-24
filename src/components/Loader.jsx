import React from 'react'

import CircularProgress from 'cozy-ui/transpiled/react/CircularProgress'

/**
 * Centered, full-height loading spinner shared by the full-screen editor views
 * (PDF, Excalidraw, OnlyOffice).
 */
const Loader = () => (
  <div className="u-flex u-flex-items-center u-flex-justify-center u-flex-grow-1">
    <CircularProgress size={80} />
  </div>
)

export default Loader
