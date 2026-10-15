import { Cross, Icon } from '@linagora/twake-icons'
import PropTypes from 'prop-types'
import React from 'react'

import AppTitle from 'cozy-ui/transpiled/react/AppTitle'
import IconButton from 'cozy-ui/transpiled/react/IconButton'
import { useI18n } from 'twake-i18n'

import { FilePickerHeaderTabs } from '@/components/FilePicker/FilePickerHeaderTabs'
import { filePickerSections } from '@/components/FilePicker/constants'
import Drive from '@/components/Icons/Drive'
import DriveText from '@/components/Icons/DriveText'
import ViewSwitcher from '@/modules/drive/Toolbar/components/ViewSwitcher'

const FilePickerHeader = ({
  activeSection,
  availableSections,
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
      <div className="u-flex u-flex-wrap u-flex-items-center u-flex-justify-between">
        <FilePickerHeaderTabs
          activeSection={activeSection}
          availableSections={availableSections}
          onSectionChange={onSectionChange}
        />
        <ViewSwitcher className="u-ml-auto u-mb-half" />
      </div>
    </div>
  )
}

FilePickerHeader.propTypes = {
  activeSection: PropTypes.oneOf(Object.values(filePickerSections)).isRequired,
  availableSections: PropTypes.arrayOf(
    PropTypes.oneOf(Object.values(filePickerSections))
  ).isRequired,
  onSectionChange: PropTypes.func.isRequired,
  onClose: PropTypes.func
}

FilePickerHeader.defaultProps = {
  availableSections: Object.values(filePickerSections)
}

export default FilePickerHeader
