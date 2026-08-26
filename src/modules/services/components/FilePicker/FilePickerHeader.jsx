import { Cross, Icon } from '@linagora/twake-icons'
import React from 'react'

import AppTitle from 'cozy-ui/transpiled/react/AppTitle'
import IconButton from 'cozy-ui/transpiled/react/IconButton'
import { useI18n } from 'twake-i18n'

import Drive from '@/components/Icons/Drive'
import DriveText from '@/components/Icons/DriveText'

const FilePickerHeader = ({ onClose }) => {
  const { t } = useI18n()

  return (
    <div
      className="u-flex u-flex-justify-between u-flex-items-center"
      data-testid="file-picker-header"
    >
      <AppTitle appIcon={Drive} appTextIcon={DriveText} />
      {onClose && (
        <IconButton onClick={onClose} aria-label={t('FilePicker.close')}>
          <Icon icon={Cross} />
        </IconButton>
      )}
    </div>
  )
}

export default FilePickerHeader
