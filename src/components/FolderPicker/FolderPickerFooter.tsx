import React from 'react'

import Buttons from 'cozy-ui/transpiled/react/Buttons'
import { useI18n } from 'twake-i18n'

import { areTargetsInCurrentDir } from '@/components/FolderPicker/helpers'
import { File, FolderPickerEntry } from '@/components/FolderPicker/types'

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
