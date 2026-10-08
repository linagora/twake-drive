import PropTypes from 'prop-types'
import React from 'react'

import flag from 'cozy-flags'
import { useSharingContext } from 'cozy-sharing'

import { useMove } from './hooks/useMove'
import { useMoveOperation } from './hooks/useMoveOperation'

import { FolderPicker } from '@/components/FolderPicker/FolderPicker'
import { MoveTo } from '@/modules/move/MoveTo'
import {
  computeNextcloudMoveDirections,
  isSharedDriveMove
} from '@/modules/move/helpers'

const MoveModal = ({
  onClose,
  currentFolder,
  entries,
  showNextcloudFolder,
  onMovingSuccess,
  isPublic,
  showSharedDriveFolder,
  driveId
}) => {
  const { allLoaded, refresh: refreshSharing } = useSharingContext()
  const { showSuccess } = useMove()

  const notifyMoveSuccess = (folder, movedEntries, trashedFiles) => {
    const { isMovingInsideNextcloud, isMovingOutsideNextcloud } =
      computeNextcloudMoveDirections(folder, movedEntries[0])

    showSuccess({
      folder,
      entries: movedEntries,
      trashedFiles,
      refreshSharing,
      canCancel:
        !isMovingInsideNextcloud &&
        !isMovingOutsideNextcloud &&
        !isSharedDriveMove(folder, movedEntries, driveId)
    })
  }

  const operation = useMoveOperation({
    entries,
    currentFolder,
    isPublic,
    driveId,
    onClose,
    onMovingSuccess,
    onSuccess: notifyMoveSuccess
  })
  const isNewMoveToEnabled = !isPublic && flag('drive.move-to-picker.enabled')

  return (
    <>
      {isNewMoveToEnabled ? (
        <MoveTo
          currentFolder={currentFolder}
          entries={operation.remainingEntries}
          onConfirm={operation.onConfirm}
          onClose={operation.onClose}
          isBusy={operation.isMoveInProgress}
          isDestinationLocked={operation.isDestinationLocked}
        />
      ) : (
        <FolderPicker
          showNextcloudFolder={showNextcloudFolder}
          showSharedDriveFolder={showSharedDriveFolder}
          currentFolder={currentFolder}
          entries={operation.remainingEntries}
          onConfirm={operation.onConfirm}
          onClose={operation.onClose}
          isBusy={operation.isMoveInProgress || (!isPublic && !allLoaded)}
          isPublic={isPublic}
        />
      )}
      {operation.confirmationDialogs}
    </>
  )
}

MoveModal.propTypes = {
  /** List of files or folder to move */
  entries: PropTypes.array,
  onMovingSuccess: PropTypes.func
}

export { MoveModal }

export default MoveModal
