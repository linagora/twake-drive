import PropTypes from 'prop-types'
import React from 'react'
import { useI18n } from 'twake-i18n'

import { useClient } from 'cozy-client'
import Button from 'cozy-ui/transpiled/react/Buttons'
import Icon from 'cozy-ui/transpiled/react/Icon'
import DownloadIcon from 'cozy-ui/transpiled/react/Icons/Download'
import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'

import { downloadFiles } from '@/modules/actions/utils'

export const DownloadFilesButton = ({
  files,
  variant = 'secondary',
  ...props
}) => {
  const { t } = useI18n()
  const client = useClient()
  const { showAlert } = useAlert()

  const handleClick = () => {
    downloadFiles(client, files, { showAlert, t })
  }

  return (
    <Button
      label={t('toolbar.menu_download')}
      data-testid="fil-public-download"
      startIcon={<Icon icon={DownloadIcon} />}
      onClick={handleClick}
      variant={variant}
      {...props}
    />
  )
}

DownloadFilesButton.propTypes = {
  files: PropTypes.array.isRequired,
  variant: PropTypes.string
}
