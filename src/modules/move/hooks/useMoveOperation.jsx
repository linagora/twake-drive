import React, { useRef, useState } from 'react'

import { fetchPolicies, useClient } from 'cozy-client'
import { useSharingContext } from 'cozy-sharing'
import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'
import { useI18n } from 'twake-i18n'

import { useCancelable } from './useCancelable'

import logger from '@/lib/logger'
import { joinPath, getParentPath } from '@/lib/path'
import { MoveInsideSharedFolderModal } from '@/modules/move/MoveInsideSharedFolderModal'
import { MoveOutsideSharedFolderModal } from '@/modules/move/MoveOutsideSharedFolderModal'
import { MoveSharedFolderInsideAnotherModal } from '@/modules/move/MoveSharedFolderInsideAnotherModal'
import {
  computeNextcloudMoveDirections,
  hasOneOfEntriesShared
} from '@/modules/move/helpers'
import { computeNextcloudFolderQueryId } from '@/modules/nextcloud/helpers'
import { executeMove } from '@/modules/paste'
import { buildFolderByPathQuery } from '@/queries'

function isInsideSameSharedFolder({
  folder,
  sourceDriveId,
  sharedParentPath,
  targetPath,
  isPublic
}) {
  return (
    (sharedParentPath && targetPath.startsWith(sharedParentPath)) ||
    (!!folder.driveId && !!sourceDriveId && folder.driveId === sourceDriveId) ||
    isPublic
  )
}

function getMoveWarningType({
  isOriginParentShared,
  isTargetShared,
  areMovedFilesShared
}) {
  if (isOriginParentShared && !isTargetShared) return 'outside'
  if (!isTargetShared) return null
  return areMovedFilesShared ? 'sharedInside' : 'inside'
}

function getMoveWarning({
  folder,
  entries,
  sourceDriveId,
  sharingContext,
  isPublic
}) {
  const { byDocId, getSharedParentPath, hasSharedParent } = sharingContext
  const sharedParentPath = entries[0].path
    ? getSharedParentPath(entries[0].path)
    : ''
  const targetPath = joinPath(folder.path, entries[0].name)
  const areMovedFilesShared = hasOneOfEntriesShared(entries, byDocId)
  const isOriginParentShared =
    hasSharedParent(entries[0].path || '') || !!sourceDriveId
  const isTargetShared =
    hasSharedParent(targetPath || '') ||
    (!!folder.driveId && folder.driveId !== sourceDriveId)
  if (
    isInsideSameSharedFolder({
      folder,
      sourceDriveId,
      sharedParentPath,
      targetPath,
      isPublic
    })
  )
    return null
  const type = getMoveWarningType({
    isOriginParentShared,
    isTargetShared,
    areMovedFilesShared
  })
  return type ? { type, entries, driveId: sourceDriveId } : null
}

function groupMoveSourcesByParent(entries) {
  const groups = new Map()
  for (const entry of entries) {
    const key = JSON.stringify([
      entry.driveId ?? null,
      entry.dir_id ?? (entry.path ? getParentPath(entry.path) : null)
    ])
    const group = groups.get(key) || []
    group.push(entry)
    groups.set(key, group)
  }
  return [...groups.values()]
}

function getMoveResult(source, result) {
  return {
    source,
    moved: result.value?.moved ?? null,
    deleted: result.value?.deleted ?? null
  }
}

function partitionMoveResults(results, entries, moveSources, includeResults) {
  const newMoveResults = []
  const movedEntries = []
  const failedEntries = []
  const trashedFiles = []
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      movedEntries.push(entries[index])
      if (includeResults)
        newMoveResults.push(getMoveResult(moveSources[index], result))
      if (result.value?.deleted) trashedFiles.push(result.value.deleted)
    } else {
      failedEntries.push(entries[index])
      logger.warn(result.reason)
    }
  })
  return { newMoveResults, movedEntries, failedEntries, trashedFiles }
}

export function useMoveOperation({
  onClose,
  currentFolder,
  entries,
  onMovingSuccess,
  isPublic,
  driveId,
  onSuccess,
  onComplete,
  validateDestination
}) {
  const client = useClient()
  const {
    sharedPaths,
    refresh: refreshSharing,
    getSharedParentPath,
    getSharingForSelf,
    hasSharedParent,
    isOwner,
    revokeSelf,
    revokeAllRecipients,
    byDocId
  } = useSharingContext()
  const { registerCancelable } = useCancelable()
  const { t } = useI18n()
  const { showAlert } = useAlert()

  const [remainingEntries, setRemainingEntries] = useState(entries)
  const [successfulEntries, setSuccessfulEntries] = useState([])
  const [successfulTrashedFiles, setSuccessfulTrashedFiles] = useState([])
  const [folderSelected, setFolderSelected] = useState(null)
  const [isMoveInProgress, setMoveInProgress] = useState(false)
  const [moveResults, setMoveResults] = useState([])
  const [pendingWarnings, setPendingWarnings] = useState([])
  const [confirmedWarnings, setConfirmedWarnings] = useState([])
  // A second confirmation can arrive before React commits the busy state.
  const moveInProgressRef = useRef(false)

  const handleConfirm = async folder => {
    if (moveInProgressRef.current || remainingEntries.length === 0) return
    const destination = successfulEntries.length > 0 ? folderSelected : folder
    setFolderSelected(destination)
    const sourceGroups = onComplete
      ? groupMoveSourcesByParent(remainingEntries)
      : [remainingEntries]
    const warnings = sourceGroups
      .map(group =>
        getMoveWarning({
          folder: destination,
          entries: group,
          sourceDriveId: onComplete ? (group[0].driveId ?? driveId) : driveId,
          sharingContext: { byDocId, getSharedParentPath, hasSharedParent },
          isPublic
        })
      )
      .filter(Boolean)
    setConfirmedWarnings([])
    setPendingWarnings(warnings)
    if (warnings.length === 0) moveEntries(destination)
  }

  const fetchOwnedSharedRoot = async (folder, ownerSharedPath) => {
    if (ownerSharedPath === folder.path) return folder
    const query = buildFolderByPathQuery(ownerSharedPath)
    const result = await client.fetchQueryAndGetFromState({
      definition: query.definition(),
      options: {
        ...query.options,
        fetchPolicy: fetchPolicies.olderThan(0)
      }
    })
    return result.data?.[0] ?? null
  }

  const fetchMoveItemWithDriveContext = async (folder, path) => {
    if (folder.driveId) return folder

    // My Drive omits driveId for owned shares, but crossing their boundary requires the shared-drive move API.
    const ownerSharedPath = getSharedParentPath(path)
    if (!ownerSharedPath) return folder

    const rootFolder = await fetchOwnedSharedRoot(folder, ownerSharedPath)
    const sharing = rootFolder && getSharingForSelf(rootFolder._id)
    if (!sharing?.attributes?.drive || !sharing.attributes.owner) return folder

    return {
      ...folder,
      driveId: sharing.id,
      cozyMetadata: {
        ...folder.cozyMetadata,
        createdOn: client.getStackClient().uri
      }
    }
  }

  const revokeEntrySharing = async entry => {
    if (byDocId[entry._id] !== undefined) {
      if (isOwner(entry._id)) await revokeAllRecipients(entry)
      else await revokeSelf(entry)
    }
  }

  const revokeMoveSharings = async sharingEntries => {
    if (sharingEntries.length === 0) return
    if (onComplete) await Promise.all(sharingEntries.map(revokeEntrySharing))
    else
      sharingEntries.forEach(async entry => {
        await revokeEntrySharing(entry)
      })
    refreshSharing()
  }

  const prepareMoveDestination = async (folder, revalidate, sharingEntries) => {
    const validatedFolder =
      revalidate && validateDestination
        ? await validateDestination(folder)
        : folder
    await revokeMoveSharings(sharingEntries)
    const force = !isPublic && !sharedPaths.includes(validatedFolder.path)
    const moveDestination = await fetchMoveItemWithDriveContext(
      validatedFolder,
      joinPath(validatedFolder.path, remainingEntries[0].name)
    )
    return { validatedFolder, force, moveDestination }
  }

  const movePendingEntries = async (moveDestination, force) => {
    const pendingByName = new Map()
    const moveSources = []
    const results = await Promise.allSettled(
      remainingEntries.map((entry, index) => {
        const previous = onComplete ? pendingByName.get(entry.name) : null
        const moveEntry = async () => {
          // Same-name replacements must observe the preceding mutation's result.
          if (previous) await Promise.allSettled([previous])
          const source = onComplete
            ? await fetchMoveItemWithDriveContext(entry, entry.path)
            : entry
          moveSources[index] = source
          return registerCancelable(
            executeMove(client, source, currentFolder, moveDestination, force)
          )
        }
        const promise = moveEntry()
        pendingByName.set(entry.name, promise)
        return promise
      })
    )
    return partitionMoveResults(
      results,
      remainingEntries,
      moveSources,
      onComplete
    )
  }

  const notifyMoveFailure = (failedEntries, allSuccessfulEntries) => {
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
  }

  const completeMove = async (folder, movedEntries, trashedFiles, results) => {
    if (onComplete) {
      await onComplete(folder, results)
    } else {
      onSuccess(folder, movedEntries, trashedFiles)
      if (onMovingSuccess) onMovingSuccess()
      else onClose()
    }
  }

  const moveEntries = async (
    folder,
    revalidate = false,
    sharingEntries = []
  ) => {
    if (moveInProgressRef.current) return
    moveInProgressRef.current = true
    try {
      setMoveInProgress(true)
      const { validatedFolder, force, moveDestination } =
        await prepareMoveDestination(folder, revalidate, sharingEntries)
      setFolderSelected(moveDestination)
      const { newMoveResults, movedEntries, failedEntries, trashedFiles } =
        await movePendingEntries(moveDestination, force)

      const allSuccessfulEntries = [...successfulEntries, ...movedEntries]
      const allTrashedFiles = [...successfulTrashedFiles, ...trashedFiles]
      const allMoveResults = [...moveResults, ...newMoveResults]
      if (onComplete) {
        setMoveResults(allMoveResults)
        setRemainingEntries(failedEntries)
        setSuccessfulEntries(allSuccessfulEntries)
        setSuccessfulTrashedFiles(allTrashedFiles)
      }

      if (movedEntries.length > 0) {
        refreshNextcloudQueries(validatedFolder, movedEntries)
        refreshSharing?.()
      }

      if (failedEntries.length > 0) {
        setRemainingEntries(failedEntries)
        setSuccessfulEntries(allSuccessfulEntries)
        setSuccessfulTrashedFiles(allTrashedFiles)
        notifyMoveFailure(failedEntries, allSuccessfulEntries)
        return
      }

      await completeMove(
        moveDestination,
        allSuccessfulEntries,
        allTrashedFiles,
        allMoveResults
      )
    } catch (e) {
      logger.warn(e)
      showAlert({
        message: t('Move.error', { smart_count: remainingEntries.length }),
        severity: 'error',
        duration: 4000
      })
    } finally {
      moveInProgressRef.current = false
      setMoveInProgress(false)
    }
  }

  const handleClose = event => {
    event?.stopPropagation()
    if (moveInProgressRef.current) return
    if (successfulEntries.length > 0) {
      onSuccess(folderSelected, successfulEntries, successfulTrashedFiles)
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

    const queryIds = new Set()
    movedEntries.forEach(entry => {
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

  const handleCancelWarning = () => setPendingWarnings([])
  const handleConfirmWarning = () => {
    const warnings = [...confirmedWarnings, pendingWarnings[0]]
    setConfirmedWarnings(warnings)
    setPendingWarnings(pendingWarnings.slice(1))
    if (pendingWarnings.length === 1) {
      const sharingEntries = warnings
        .filter(warning => warning.type === 'sharedInside')
        .flatMap(warning => warning.entries)
      moveEntries(folderSelected, true, sharingEntries)
    }
  }
  const warning = pendingWarnings[0] ?? null

  return {
    remainingEntries,
    moveResults,
    destination: folderSelected,
    isMoveInProgress,
    isDestinationLocked: successfulEntries.length > 0,
    onConfirm: handleConfirm,
    onClose: handleClose,
    confirmationDialogs: (
      <>
        {warning?.type === 'outside' ? (
          <MoveOutsideSharedFolderModal
            entries={warning.entries}
            onCancel={handleCancelWarning}
            onConfirm={handleConfirmWarning}
            driveId={warning.driveId}
          />
        ) : null}
        {warning?.type === 'sharedInside' ? (
          <MoveSharedFolderInsideAnotherModal
            entries={warning.entries}
            folderId={folderSelected._id}
            driveId={folderSelected.driveId}
            onCancel={handleCancelWarning}
            onConfirm={handleConfirmWarning}
          />
        ) : null}
        {warning?.type === 'inside' ? (
          <MoveInsideSharedFolderModal
            onCancel={handleCancelWarning}
            onConfirm={handleConfirmWarning}
            entries={warning.entries}
            folderId={folderSelected._id}
            driveId={folderSelected.driveId}
          />
        ) : null}
      </>
    )
  }
}
