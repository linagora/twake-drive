import React, { useState } from 'react'
import { NavigateFunction } from 'react-router-dom'
import { useI18n } from 'twake-i18n'

import { useClient } from 'cozy-client'
import Button from 'cozy-ui/transpiled/react/Buttons'
import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'

import { OpenFolderButton } from '@/components/Button/OpenFolderButton'
import { File, FolderPickerEntry } from '@/components/FolderPicker/types'
import { cancelMove } from '@/modules/move/helpers'
import { useCancelable } from '@/modules/move/hooks/useCancelable'

interface MoveModalSuccessActionProps {
  folder: File
  entries: FolderPickerEntry[]
  trashedFiles: File[]
  canCancel?: boolean
  refreshSharing: () => void
  navigate: NavigateFunction
}

const MoveModalSuccessAction: React.FC<MoveModalSuccessActionProps> = ({
  folder,
  entries,
  trashedFiles,
  canCancel = true,
  refreshSharing,
  navigate
}) => {
  const { t } = useI18n()
  const client = useClient()
  const { registerCancelable } = useCancelable()
  const [isCancelling, setCancelling] = useState(false)
  const { showAlert } = useAlert()

  const handleCancel = async (): Promise<void> => {
    setCancelling(true)
    await cancelMove({
      entries,
      trashedFiles,
      client,
      registerCancelable,
      showAlert,
      t,
      refreshSharing
    })
  }

  return (
    <>
      {canCancel ? (
        <Button
          label={t('Move.cancel')}
          onClick={handleCancel}
          size="small"
          variant="text"
          disabled={isCancelling}
          style={{ color: `var(--successContrastTextColor)` }}
        />
      ) : null}
      <OpenFolderButton folder={folder} navigate={navigate} />
    </>
  )
}

export { MoveModalSuccessAction }
