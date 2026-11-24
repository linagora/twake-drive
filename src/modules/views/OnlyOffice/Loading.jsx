import React from 'react'

import CircularProgress from 'cozy-ui/transpiled/react/CircularProgress'
import { DialogContent } from 'cozy-ui/transpiled/react/Dialog'

const Loading = () => {
  return (
    <DialogContent className="u-flex u-flex-items-center u-flex-justify-center">
      <span data-testid="onlyoffice-content-spinner">
        <CircularProgress size={80} />
      </span>
    </DialogContent>
  )
}

export default Loading
