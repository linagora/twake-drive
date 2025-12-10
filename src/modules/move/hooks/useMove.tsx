import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from 'twake-i18n'

import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'

import { File, FolderPickerEntry } from '@/components/FolderPicker/types'
import { MoveModalSuccessAction } from '@/modules/move/components/MoveModalSuccessAction'

interface useMoveProps {
  entries: FolderPickerEntry[]
}

interface showSuccessProps {
  folder: File
  trashedFiles: File[]
  canCancel?: boolean
  refreshSharing: () => void
}

interface useMoveReturn {
  showSuccess: (props: showSuccessProps) => void
}

const useMove = ({ entries }: useMoveProps): useMoveReturn => {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { showAlert } = useAlert()

  const showSuccess = ({
    folder,
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
