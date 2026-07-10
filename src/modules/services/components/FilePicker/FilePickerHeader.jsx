import React from 'react'

import AppTitle from 'cozy-ui/transpiled/react/AppTitle'

import Drive from '@/components/Icons/Drive'
import DriveText from '@/components/Icons/DriveText'

const FilePickerHeader = () => (
  <div className="u-flex u-flex-items-center" data-testid="file-picker-header">
    <AppTitle appIcon={Drive} appTextIcon={DriveText} />
  </div>
)

export default FilePickerHeader
