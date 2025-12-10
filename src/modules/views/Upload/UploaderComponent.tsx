import React from 'react'
import { useI18n } from 'twake-i18n'

import { useQuery } from 'cozy-client'
import { IOCozyFile } from 'cozy-client/types/types'
import { FixedDialog } from 'cozy-ui/transpiled/react/CozyDialogs'
import Spinner from 'cozy-ui/transpiled/react/Spinner'

import { FolderPicker } from '@/components/FolderPicker/FolderPicker'
import { File, FolderPickerEntry } from '@/components/FolderPicker/types'
import { ROOT_DIR_ID } from '@/constants/config'
import { shouldRender } from '@/modules/views/Upload/UploadUtils'
import { useUploadFromFlagship } from '@/modules/views/Upload/useUploadFromFlagship'
import { buildFileOrFolderByIdQuery } from '@/queries'

const UploaderComponent = (): JSX.Element | null => {
  const { t } = useI18n()
  const { items, uploadFilesFromFlagship, onClose, uploadInProgress } =
    useUploadFromFlagship()

  const handleConfirm = (folder?: File): void => {
    if (!folder?._id) {
      throw new Error('A folder id is required')
    }
    uploadFilesFromFlagship(folder._id)
  }

  const rootFolderQuery = buildFileOrFolderByIdQuery(ROOT_DIR_ID)
  const rootFolderResult = useQuery(
    rootFolderQuery.definition,
    rootFolderQuery.options
  ) as {
    data?: IOCozyFile
  }

  if (shouldRender(items) && rootFolderResult.data) {
    const fakeFiles: FolderPickerEntry[] = items.map(item => ({
      _type: 'io.cozy.files',
      type: 'file',
      dir_id: item.dirId,
      name: item.fileName,
      mime: item.mimeType
    }))

    return (
      <FolderPicker
        currentFolder={rootFolderResult.data}
        entries={fakeFiles}
        canCreateFolder={false}
        onConfirm={handleConfirm}
        onClose={onClose}
        isBusy={uploadInProgress}
        slotProps={{
          header: {
            title: t('ImportToDrive.title', { smart_count: fakeFiles.length }),
            subTitle: t('ImportToDrive.to')
          },
          footer: {
            confirmLabel: t('ImportToDrive.action'),
            cancelLabel: t('ImportToDrive.cancel')
          }
        }}
      />
    )
  }

  // If there are no items to render, we display a spinner with a full screen dialog to hide the UI behind
  return (
    <FixedDialog
      className="u-p-0"
      open
      size="large"
      content={<Spinner size="xxlarge" noMargin middle />}
    />
  )
}

export { UploaderComponent }
