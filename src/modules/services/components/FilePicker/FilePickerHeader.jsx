import { Icon } from '@linagora/twake-icons'
import PropTypes from 'prop-types'
import React, { memo } from 'react'

import AppTitle from 'cozy-ui/transpiled/react/AppTitle'
import IconButton from 'cozy-ui/transpiled/react/IconButton'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'

import Drive from '@/components/Icons/Drive'
import DriveText from '@/components/Icons/DriveText'

const FilePickerHeader = ({ onClose }) => {
  const { isMobile } = useBreakpoints()

  return (
    <div
      className="u-flex u-flex-items-center"
      data-testid="file-picker-header"
    >
      <AppTitle appIcon={Drive} appTextIcon={DriveText} />
      {isMobile && (
        <IconButton onClick={onClose} className="u-ml-auto" size="medium">
          <Icon icon="cross-medium" />
        </IconButton>
      )}
    </div>
  )
}

FilePickerHeader.propTypes = {
  onClose: PropTypes.func.isRequired
}

export default memo(FilePickerHeader)
