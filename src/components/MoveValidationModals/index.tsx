import React from 'react'

import { useClipboardContext } from '@/contexts/ClipboardProvider'
import { MoveInsideSharedFolderModal } from '@/modules/move/MoveInsideSharedFolderModal'
import { MoveOutsideSharedFolderModal } from '@/modules/move/MoveOutsideSharedFolderModal'
import { MoveSharedFolderInsideAnotherModal } from '@/modules/move/MoveSharedFolderInsideAnotherModal'

const MoveValidationModals: React.FC = () => {
  const { moveValidationModal, hideMoveValidationModal } = useClipboardContext()

  if (!moveValidationModal.isVisible) {
    return null
  }

  const handleCancel = (): void => {
    if (moveValidationModal.onCancel) {
      moveValidationModal.onCancel()
    }
    hideMoveValidationModal()
  }

  const handleConfirm = async (): Promise<void> => {
    if (moveValidationModal.onConfirm) {
      await moveValidationModal.onConfirm()
    }
    hideMoveValidationModal()
  }

  /** This component renders move validation modals (MoveOutside/Inside/SharedInside)
   * triggered by keyboard shortcuts during cut/paste operations across different views
   */
  switch (moveValidationModal.type) {
    case 'moveOutside':
      return (
        <MoveOutsideSharedFolderModal
          entries={[moveValidationModal.file]}
          onCancel={handleCancel}
          onConfirm={handleConfirm}
          driveId={moveValidationModal.file?.driveId}
        />
      )
    case 'moveInside':
      return (
        <MoveInsideSharedFolderModal
          entries={[moveValidationModal.file]}
          folderId={moveValidationModal.targetFolder._id}
          onCancel={handleCancel}
          onConfirm={handleConfirm}
          driveId={moveValidationModal.targetFolder.driveId}
        />
      )
    case 'moveSharedInside':
      return (
        <MoveSharedFolderInsideAnotherModal
          entries={[moveValidationModal.file]}
          folderId={moveValidationModal.targetFolder._id}
          onCancel={handleCancel}
          onConfirm={handleConfirm}
          driveId={moveValidationModal.targetFolder.driveId}
        />
      )
    default:
      return null
  }
}

export default MoveValidationModals
