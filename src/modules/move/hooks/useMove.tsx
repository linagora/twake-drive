import React from 'react'
import { useNavigate } from 'react-router-dom'

import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'
import { useI18n } from 'twake-i18n'

import { File, FolderPickerEntry } from '@/components/FolderPicker/types'
import { MoveModalSuccessAction } from '@/modules/move/components/MoveModalSuccessAction'

interface showSuccessProps {
  folder: File
  entries: FolderPickerEntry[]
  trashedFiles: File[]
  canCancel?: boolean
  refreshSharing: () => void
}

interface useMoveReturn {
  showSuccess: (props: showSuccessProps) => void
}

const useMove = (): useMoveReturn => {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { showAlert } = useAlert()

  const showSuccess = ({
    folder,
    entries,
    trashedFiles,
    canCancel = true,
    refreshSharing
  }: showSuccessProps): void => {
    const targetName = folder.name || t('breadcrumb.title_drive')

    showAlert({
      message: t('Move.success', {
        smart_count: entries.length,
        subject: entries.length === 1 ? entries[0].name : '',
        target: targetName
      }),
      severity: 'success',
      action: (
        <MoveModalSuccessAction
          folder={folder}
          entries={entries}
          trashedFiles={trashedFiles}
          canCancel={canCancel}
          refreshSharing={refreshSharing}
          navigate={navigate}
        />
      )
    })
  }

  return { showSuccess }
}

export { useMove }
