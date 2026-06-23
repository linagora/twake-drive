import React from 'react'

import { useClient } from 'cozy-client'
import Buttons from 'cozy-ui/transpiled/react/Buttons'

import { downloadFile } from './helpers'

const NoViewerButton = ({ file, t }) => {
  const client = useClient()
  return (
    <Buttons
      onClick={() => downloadFile(client, file)}
      label={t('Viewer.noviewer.download')}
    />
  )
}

export default NoViewerButton
