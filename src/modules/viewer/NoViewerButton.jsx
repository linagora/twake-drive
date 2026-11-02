import React from 'react'

import { useClient } from 'cozy-client'
import Buttons from 'cozy-ui/transpiled/react/Buttons'
import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'

import { downloadFile } from './helpers'

import { showDownloadError } from '@/modules/actions/utils'

const NoViewerButton = ({ file, t }) => {
  const client = useClient()
  const { showAlert } = useAlert()
  return (
    <Buttons
      onClick={() =>
        downloadFile(client, file).catch(error =>
          showDownloadError(error, { showAlert, t })
        )
      }
      label={t('Viewer.noviewer.download')}
    />
  )
}

export default NoViewerButton
