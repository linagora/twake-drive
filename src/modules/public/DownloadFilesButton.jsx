import { Icon, Download } from '@linagora/twake-icons'
import PropTypes from 'prop-types'
import React from 'react'

import { useClient } from 'cozy-client'
import Button from 'cozy-ui/transpiled/react/Buttons'
import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'
import { useI18n } from 'twake-i18n'

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
      startIcon={<Icon icon={Download} />}
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
