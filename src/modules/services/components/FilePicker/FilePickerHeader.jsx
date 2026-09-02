import { Cross, Icon } from '@linagora/twake-icons'
import PropTypes from 'prop-types'
import React from 'react'

import AppTitle from 'cozy-ui/transpiled/react/AppTitle'
import IconButton from 'cozy-ui/transpiled/react/IconButton'
import { useI18n } from 'twake-i18n'

import FilePickerHeaderTabs from './FilePickerHeaderTabs'
import { filePickerSections } from './constants'

import Drive from '@/components/Icons/Drive'
import DriveText from '@/components/Icons/DriveText'

export const FilePickerHeader = ({
  activeSection,
  onSectionChange,
  onClose
}) => {
  const { t } = useI18n()

  return (
    <div className="u-flex u-flex-column" data-testid="file-picker-header">
      <div className="u-flex u-flex-justify-between u-flex-items-center">
        <AppTitle appIcon={Drive} appTextIcon={DriveText} />
        {onClose && (
          <IconButton onClick={onClose} aria-label={t('FilePicker.close')}>
            <Icon icon={Cross} />
          </IconButton>
        )}
      </div>
      <FilePickerHeaderTabs
        activeSection={activeSection}
        onSectionChange={onSectionChange}
      />
    </div>
  )
}

FilePickerHeader.propTypes = {
  activeSection: PropTypes.oneOf(Object.values(filePickerSections)).isRequired,
  onSectionChange: PropTypes.func.isRequired,
  onClose: PropTypes.func
}

export default FilePickerHeader
