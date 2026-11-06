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

  // Hide first: the callback may open the next warning of the same paste.
  const handleCancel = (): void => {
    hideMoveValidationModal()
    if (moveValidationModal.onCancel) {
      moveValidationModal.onCancel()
    }
  }

  const handleConfirm = async (): Promise<void> => {
    hideMoveValidationModal()
    if (moveValidationModal.onConfirm) {
      await moveValidationModal.onConfirm()
    }
  }

  /** This component renders move validation modals (MoveOutside/Inside/SharedInside)
   * triggered by keyboard shortcuts during cut/paste operations across different views
   */
  switch (moveValidationModal.type) {
    case 'moveOutside':
      return (
        <MoveOutsideSharedFolderModal
          entries={moveValidationModal.files}
          onCancel={handleCancel}
          onConfirm={handleConfirm}
          driveId={moveValidationModal.files[0]?.driveId}
        />
      )
    case 'moveInside':
      return (
        <MoveInsideSharedFolderModal
          entries={moveValidationModal.files}
          folderId={moveValidationModal.targetFolder._id}
          onCancel={handleCancel}
          onConfirm={handleConfirm}
          driveId={moveValidationModal.targetFolder.driveId}
        />
      )
    case 'moveSharedInside':
      return (
        <MoveSharedFolderInsideAnotherModal
          entries={moveValidationModal.files}
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
