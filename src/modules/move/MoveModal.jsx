import PropTypes from 'prop-types'
import React, { useState } from 'react'

import { useClient } from 'cozy-client'
import flag from 'cozy-flags'
import { useSharingContext } from 'cozy-sharing'
import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'
import { useI18n } from 'twake-i18n'

import { useMove } from './hooks/useMove'

import { FolderPicker } from '@/components/FolderPicker/FolderPicker'
import logger from '@/lib/logger'
import { joinPath, getParentPath } from '@/lib/path'
import { MoveInsideSharedFolderModal } from '@/modules/move/MoveInsideSharedFolderModal'
import { MoveOutsideSharedFolderModal } from '@/modules/move/MoveOutsideSharedFolderModal'
import { MoveSharedFolderInsideAnotherModal } from '@/modules/move/MoveSharedFolderInsideAnotherModal'
import { MoveTo } from '@/modules/move/MoveTo'
import {
  computeNextcloudMoveDirections,
  hasOneOfEntriesShared,
  isSharedDriveMove
} from '@/modules/move/helpers'
import { useCancelable } from '@/modules/move/hooks/useCancelable'
import { computeNextcloudFolderQueryId } from '@/modules/nextcloud/helpers'
import { executeMove } from '@/modules/paste'

/**
 * Modal to move a folder to an other
 */
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
  const client = useClient()
  const {
    sharedPaths,
    refresh: refreshSharing,
    getSharedParentPath,
    hasSharedParent,
    isOwner,
    revokeSelf,
    revokeAllRecipients,
    byDocId,
    allLoaded
  } = useSharingContext()
  const { registerCancelable } = useCancelable()
  const { showSuccess } = useMove()
  const { t } = useI18n()
  const { showAlert } = useAlert()

  const [remainingEntries, setRemainingEntries] = useState(entries)
  const [successfulEntries, setSuccessfulEntries] = useState([])
  const [successfulTrashedFiles, setSuccessfulTrashedFiles] = useState([])
  const [folderSelected, setFolderSelected] = useState(null)
  const [isMoveInProgress, setMoveInProgress] = useState(false)
  const [isMovingOutsideSharedFolder, setMovingOutsideSharedFolder] =
    useState(false)
  const [
    isMovingSharedFolderInsideAnother,
    setMovingSharedFolderInsideAnother
  ] = useState(false)
  const [isMovingInsideSharedFolder, setMovingInsideSharedFolder] =
    useState(false)

  const handleConfirm = async folder => {
    setFolderSelected(folder)

    const sharedParentPath = remainingEntries[0].path
      ? getSharedParentPath(remainingEntries[0].path)
      : ''
    const targetPath = joinPath(folder.path, remainingEntries[0].name)

    const areMovedFilesShared = hasOneOfEntriesShared(remainingEntries, byDocId)
    const isOriginParentShared =
      hasSharedParent(remainingEntries[0].path || '') || !!driveId
    const isTargetShared =
      hasSharedParent(targetPath || '') ||
      (!!folder.driveId && folder.driveId !== driveId)
    const isInsideSameSharedFolder =
      (sharedParentPath && targetPath.startsWith(sharedParentPath)) ||
      (!!folder.driveId && !!driveId && folder.driveId === driveId) ||
      isPublic

    if (isInsideSameSharedFolder) {
      moveEntries(folder)
      return
    }

    if (isOriginParentShared && !isTargetShared) {
      setMovingOutsideSharedFolder(true)
      return
    }

    if (!areMovedFilesShared && isTargetShared) {
      setMovingInsideSharedFolder(true)
      return
    }

    if (areMovedFilesShared && isTargetShared) {
      setMovingSharedFolderInsideAnother(true)
      return
    }

    moveEntries(folder)
  }

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

  const moveEntries = async folder => {
    try {
      setMoveInProgress(true)
      const force = !isPublic && !sharedPaths.includes(folder.path)
      const results = await Promise.allSettled(
        remainingEntries.map(entry =>
          registerCancelable(
            executeMove(client, entry, currentFolder, folder, force)
          )
        )
      )
      const movedEntries = []
      const failedEntries = []
      const trashedFiles = []
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          movedEntries.push(remainingEntries[index])
          if (result.value?.deleted) trashedFiles.push(result.value.deleted)
        } else {
          failedEntries.push(remainingEntries[index])
          logger.warn(result.reason)
        }
      })

      const allSuccessfulEntries = [...successfulEntries, ...movedEntries]
      const allTrashedFiles = [...successfulTrashedFiles, ...trashedFiles]

      if (movedEntries.length > 0) {
        refreshNextcloudQueries(folder, movedEntries)
        refreshSharing?.()
      }

      if (failedEntries.length > 0) {
        setRemainingEntries(failedEntries)
        setSuccessfulEntries(allSuccessfulEntries)
        setSuccessfulTrashedFiles(allTrashedFiles)
        showAlert({
          message:
            allSuccessfulEntries.length > 0
              ? t('Move.partialError', {
                  successCount: allSuccessfulEntries.length,
                  failureCount: failedEntries.length
                })
              : t('Move.error', { smart_count: failedEntries.length }),
          severity: 'error',
          duration: 4000
        })
        return
      }

      notifyMoveSuccess(folder, allSuccessfulEntries, allTrashedFiles)
      if (onMovingSuccess) {
        onMovingSuccess()
      } else {
        onClose()
      }
    } catch (e) {
      logger.warn(e)
      showAlert({
        message: t('Move.error', { smart_count: remainingEntries.length }),
        severity: 'error',
        duration: 4000
      })
    } finally {
      setMoveInProgress(false)
    }
  }

  const handleClose = event => {
    event?.stopPropagation()
    if (successfulEntries.length > 0) {
      notifyMoveSuccess(
        folderSelected,
        successfulEntries,
        successfulTrashedFiles
      )
    }
    onClose()
  }

  /**
   * The content from nextcloud queries must be refreshed when moving files
   * This is only a proxy to Nextcloud queries so we don't have real-time or mutations updates
   */
  const refreshNextcloudQueries = (folder, movedEntries) => {
    const { isMovingInsideNextcloud } = computeNextcloudMoveDirections(
      folder,
      movedEntries[0]
    )

    if (isMovingInsideNextcloud) {
      client.resetQuery(
        computeNextcloudFolderQueryId({
          sourceAccount: folder.cozyMetadata?.sourceAccount,
          path: folder.path
        })
      )
    }

    const entries = Array.isArray(movedEntries) ? movedEntries : [movedEntries]
    const queryIds = new Set()
    entries.forEach(entry => {
      const { isMovingOutsideNextcloud } = computeNextcloudMoveDirections(
        folder,
        entry
      )
      if (isMovingOutsideNextcloud) {
        const parentPath = entry.parentPath ?? getParentPath(entry.path) ?? '/'
        queryIds.add(
          computeNextcloudFolderQueryId({
            sourceAccount: entry.cozyMetadata?.sourceAccount,
            path: parentPath
          })
        )
      }
    })
    queryIds.forEach(queryId => client.resetQuery(queryId))
  }

  const handleCancelMovingOutside = () => {
    setMovingOutsideSharedFolder(false)
  }

  const handleConfirmMovingOutside = () => {
    setMovingOutsideSharedFolder(false)
    moveEntries(folderSelected)
  }

  const handleCancelMovingInside = () => {
    setMovingInsideSharedFolder(false)
  }

  const handleConfirmMovingInside = () => {
    setMovingInsideSharedFolder(false)
    moveEntries(folderSelected)
  }

  const handleMovingSharedFolderInsideAnother = async () => {
    setMoveInProgress(true)
    remainingEntries.forEach(async entry => {
      if (byDocId[entry._id] !== undefined) {
        if (isOwner(entry._id)) {
          await revokeAllRecipients(entry)
        } else {
          await revokeSelf(entry)
        }
      }
    })
    refreshSharing()
    moveEntries(folderSelected)
    setMovingSharedFolderInsideAnother(false)
  }

  const isNewMoveToEnabled = !isPublic && flag('drive.move-to-picker.enabled')

  return (
    <>
      {isNewMoveToEnabled ? (
        <MoveTo
          currentFolder={currentFolder}
          entries={remainingEntries}
          onConfirm={handleConfirm}
          onClose={handleClose}
          isBusy={isMoveInProgress}
          isDestinationLocked={successfulEntries.length > 0}
        />
      ) : (
        <FolderPicker
          showNextcloudFolder={showNextcloudFolder}
          showSharedDriveFolder={showSharedDriveFolder}
          currentFolder={currentFolder}
          entries={remainingEntries}
          onConfirm={handleConfirm}
          onClose={handleClose}
          isBusy={isMoveInProgress || (!isPublic && !allLoaded)}
          isPublic={isPublic}
        />
      )}
      {isMovingOutsideSharedFolder ? (
        <MoveOutsideSharedFolderModal
          entries={remainingEntries}
          onCancel={handleCancelMovingOutside}
          onConfirm={handleConfirmMovingOutside}
          driveId={driveId}
        />
      ) : null}
      {isMovingSharedFolderInsideAnother ? (
        <MoveSharedFolderInsideAnotherModal
          entries={remainingEntries}
          folderId={folderSelected._id}
          driveId={folderSelected.driveId}
          onCancel={() => setMovingSharedFolderInsideAnother(false)}
          onConfirm={handleMovingSharedFolderInsideAnother}
        />
      ) : null}
      {isMovingInsideSharedFolder ? (
        <MoveInsideSharedFolderModal
          onCancel={handleCancelMovingInside}
          onConfirm={handleConfirmMovingInside}
          entries={remainingEntries}
          folderId={folderSelected._id}
          driveId={folderSelected.driveId}
        />
      ) : null}
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
