import PropTypes from 'prop-types'
import React, { useState } from 'react'

import { useClient } from 'cozy-client'
import { useSharingContext } from 'cozy-sharing'
import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'
import { useI18n } from 'cozy-ui/transpiled/react/providers/I18n'

import { useMove } from './hooks/useMove'

import { FolderPicker } from '@/components/FolderPicker/FolderPicker'
import logger from '@/lib/logger'
import { joinPath, getParentPath } from '@/lib/path'
import { MoveInsideSharedFolderModal } from '@/modules/move/MoveInsideSharedFolderModal'
import { MoveOutsideSharedFolderModal } from '@/modules/move/MoveOutsideSharedFolderModal'
import { MoveSharedFolderInsideAnotherModal } from '@/modules/move/MoveSharedFolderInsideAnotherModal'
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
  const { showSuccess } = useMove({ entries })
  const { t } = useI18n()
  const { showAlert } = useAlert()

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

    const sharedParentPath = getSharedParentPath(entries[0].path)
    const targetPath = joinPath(folder.path, entries[0].name)

    const areMovedFilesShared = hasOneOfEntriesShared(entries, byDocId)
    const isOriginParentShared = hasSharedParent(entries[0].path) || !!driveId
    const isTargetShared =
      hasSharedParent(targetPath) ||
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

  const moveEntries = async folder => {
    try {
      setMoveInProgress(true)
      const trashedFiles = []
      const force = !sharedPaths.includes(folder.path)
      await Promise.all(
        entries.map(async entry => {
          const moveResponse = await registerCancelable(
            executeMove(client, entry, currentFolder, folder, force)
          )
          if (moveResponse.deleted) {
            trashedFiles.push(moveResponse.deleted)
          }
        })
      )

      const isMovingInsideNextcloud =
        folder._type === 'io.cozy.remote.nextcloud.files'

      const isMovingOutsideNextcloud =
        !isMovingInsideNextcloud &&
        entries[0]._type === 'io.cozy.remote.nextcloud.files'

      refreshNextcloudQueries({
        isMovingInsideNextcloud,
        isMovingOutsideNextcloud,
        folder
      })

      showSuccess({
        folder,
        trashedFiles,
        refreshSharing,
        canCancel: !isMovingInsideNextcloud && !isMovingOutsideNextcloud
      })

      if (refreshSharing) refreshSharing()

      onMovingSuccess?.()
    } catch (e) {
      logger.warn(e)
      showAlert({
        message: t('Move.error', { smart_count: entries.length }),
        severity: 'error'
      })
    } finally {
      setMoveInProgress(false)
      onClose()
    }
  }

  /**
   * The content from nextcloud queries must be refreshed when moving files
   * This is only a proxy to Nextcloud queries so we don't have real-time or mutations updates
   */
  const refreshNextcloudQueries = ({
    isMovingOutsideNextcloud,
    isMovingInsideNextcloud,
    folder
  }) => {
    if (isMovingInsideNextcloud) {
      client.resetQuery(
        computeNextcloudFolderQueryId({
          sourceAccount: folder.cozyMetadata.sourceAccount,
          path: folder.path
        })
      )
    }

    if (isMovingOutsideNextcloud) {
      client.resetQuery(
        computeNextcloudFolderQueryId({
          sourceAccount: entries[0].cozyMetadata.sourceAccount,
          path: getParentPath(entries[0].path)
        })
      )
    }
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
    entries.forEach(async entry => {
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

  return (
    <>
      <FolderPicker
        showNextcloudFolder={showNextcloudFolder}
        showSharedDriveFolder={showSharedDriveFolder}
        currentFolder={currentFolder}
        entries={entries}
        onConfirm={handleConfirm}
        onClose={onClose}
        isBusy={isMoveInProgress || (!isPublic && !allLoaded)}
        isPublic={isPublic}
      />
      {isMovingOutsideSharedFolder ? (
        <MoveOutsideSharedFolderModal
          entries={entries}
          onCancel={handleCancelMovingOutside}
          onConfirm={handleConfirmMovingOutside}
          driveId={driveId}
        />
      ) : null}
      {isMovingSharedFolderInsideAnother ? (
        <MoveSharedFolderInsideAnotherModal
          entries={entries}
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
          entries={entries}
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
