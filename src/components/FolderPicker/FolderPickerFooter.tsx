import React from 'react'
import { useI18n } from 'twake-i18n'

import { IOCozyFile } from 'cozy-client/types/types'
import Buttons from 'cozy-ui/transpiled/react/Buttons'

import { areTargetsInCurrentDir } from '@/components/FolderPicker/helpers'
import { File, FolderPickerEntry } from '@/components/FolderPicker/types'
import { ROOT_DIR_ID, SHARED_DRIVES_DIR_ID } from '@/constants/config'

interface FolderPickerFooterProps {
  onConfirm: (folder: File) => void
  onClose: () => void | Promise<void>
  entries: FolderPickerEntry[]
  folder: File
  isBusy?: boolean
  confirmLabel?: string
  cancelLabel?: string
  canPickEntriesParentFolder?: boolean
}

/**
 * List of actions for the move modal
 */
const FolderPickerFooter: React.FC<FolderPickerFooterProps> = ({
  onConfirm,
  onClose,
  entries,
  folder,
  isBusy = false,
  confirmLabel,
  cancelLabel,
  canPickEntriesParentFolder
}) => {
  const { t } = useI18n()
  const primaryText = confirmLabel ? confirmLabel : t('Move.action')
  const secondaryText = cancelLabel ? cancelLabel : t('Move.cancel')

  const handleClick = (): void => {
    onConfirm(folder)
  }

  const isDisabled =
    isBusy ||
    ((folder as IOCozyFile).dir_id === ROOT_DIR_ID &&
      folder._id === SHARED_DRIVES_DIR_ID) ||
    (!canPickEntriesParentFolder && areTargetsInCurrentDir(entries, folder))

  return (
    <>
      <Buttons variant="secondary" label={secondaryText} onClick={onClose} />
      <Buttons
        label={primaryText}
        onClick={handleClick}
        disabled={isDisabled}
        busy={isBusy}
      />
    </>
  )
}

export { FolderPickerFooter }
