import React from 'react'

import FilenameInput from '@/modules/filelist/FilenameInput'
import FileIconMime from '@/modules/filelist/icons/FileIconMime'

const AddFolderRow = ({ onSubmit, onAbort }) => {
  return (
    <div className="u-flex u-flex-items-center">
      <FileIconMime file={{ type: 'directory' }} size={35} />
      <FilenameInput
        className="u-ml-half u-m-half"
        onSubmit={onSubmit}
        onAbort={onAbort}
      />
    </div>
  )
}

export default AddFolderRow
