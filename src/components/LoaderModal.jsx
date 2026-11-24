import React from 'react'

import CircularProgress from 'cozy-ui/transpiled/react/CircularProgress'
import { ConfirmDialog } from 'cozy-ui/transpiled/react/CozyDialogs'

/**
 * Loading state for move alert modal
 */
const LoaderModal = () => {
  return (
    <ConfirmDialog
      open
      content={
        <div className="u-h-3 u-flex u-flex-items-center u-flex-justify-center">
          <CircularProgress size={36} />
        </div>
      }
    />
  )
}

export { LoaderModal }
