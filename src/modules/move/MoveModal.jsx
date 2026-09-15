import PropTypes from 'prop-types'
import React, { useState } from 'react'

import { useClient } from 'cozy-client'
import flag from 'cozy-flags'
import { useSharingContext } from 'cozy-sharing'
import useBrowserOffline from 'cozy-ui/transpiled/react/hooks/useBrowserOffline'
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
import { hasOneOfEntriesShared } from '@/modules/move/helpers'
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
  const isOffline = useBrowserOffline()

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
    if (isOffline) {
      moveEntries(folder)
      return
    }

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
    const isMovingInsideNextcloud =
      folder?._type === 'io.cozy.remote.nextcloud.files'
    const isMovingOutsideNextcloud =
      !isMovingInsideNextcloud &&
      movedEntries[0]?._type === 'io.cozy.remote.nextcloud.files'

    showSuccess({
      folder,
      entries: movedEntries,
      trashedFiles,
      refreshSharing,
      canCancel: !isMovingInsideNextcloud && !isMovingOutsideNextcloud
    })
  }

  const moveEntries = async folder => {
    if (isOffline) {
      showAlert({
        message: t('Move.error', { smart_count: remainingEntries.length }),
        severity: 'error',
        duration: 4000
      })
      return
    }

    try {
      setMoveInProgress(true)
      const force = !sharedPaths.includes(folder.path)
      const results = await Promise.allSettled(
        remainingEntries.map(entry =>
          registerCancelable(
            executeMove(client, entry, currentFolder, folder, force)
          )
        )
      )
      const movedEntries = remainingEntries.filter(
        (_entry, index) => results[index].status === 'fulfilled'
      )
      const failedEntries = remainingEntries.filter(
        (_entry, index) => results[index].status === 'rejected'
      )
      const trashedFiles = results.flatMap(result =>
        result.status === 'fulfilled' && result.value?.deleted
          ? [result.value.deleted]
          : []
      )
      results.forEach(result => {
        if (result.status === 'rejected') logger.warn(result.reason)
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
    const isMovingInsideNextcloud =
      folder?._type === 'io.cozy.remote.nextcloud.files'

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
      if (
        !isMovingInsideNextcloud &&
        entry?._type === 'io.cozy.remote.nextcloud.files'
      ) {
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
