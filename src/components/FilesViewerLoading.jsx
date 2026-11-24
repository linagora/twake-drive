import React from 'react'

import Backdrop from 'cozy-ui/transpiled/react/Backdrop'
import CircularProgress from 'cozy-ui/transpiled/react/CircularProgress'

const FilesViewerLoading = () => (
  <Backdrop isOver open>
    <CircularProgress
      className="u-primaryContrastTextColor"
      color="inherit"
      size={80}
    />
  </Backdrop>
)

export { FilesViewerLoading }
