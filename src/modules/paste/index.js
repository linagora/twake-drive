import {
  isFile,
  copy,
  move,
  moveRelateToSharedDrive
} from 'cozy-client/dist/models/file'

import { resolveNameConflictsForCut } from './utils'

import { ROOT_DIR_ID, NEXTCLOUD_FILE_ID } from '@/constants/config'
import { DOCTYPE_FILES } from '@/lib/doctypes'
import logger from '@/lib/logger'
import { joinPath } from '@/lib/path'
import { hasOneOfEntriesShared } from '@/modules/move/helpers'
import { computeNextcloudFolderQueryId } from '@/modules/nextcloud/helpers'

/**
 * Executes move or copy operations for shared drive files/folders.
 * Handles the specific API calls required for shared drive operations.
 *
 * @param {CozyClient} client - The cozy client instance
 * @param {import('@/components/FolderPicker/types').File} entry - The file or folder to move/copy
 * @param {import('@/components/FolderPicker/types').File} sourceDirectory - The source directory containing the entry
 * @param {import('@/components/FolderPicker/types').File} destDirectory - The destination directory
 * @param {string} operation - The operation type ('move' or 'copy')
 * @returns {Promise<Object>} The result of the shared drive operation
 */
const executeSharedDriveMoveOrCopy = async (
  client,
  entry,
  sourceDirectory,
  destDirectory,
  operation
) => {
  return await moveRelateToSharedDrive(
    client,
    {
      instance: entry.driveId
        ? sourceDirectory.attributes?.cozyMetadata?.createdOn
        : '',
      file_id: isFile(entry) ? entry._id : '',
      dir_id: !isFile(entry) ? entry._id : '',
      sharing_id: entry.driveId
    },
    {
      instance: destDirectory.driveId
        ? destDirectory.cozyMetadata?.createdOn
        : '',
      sharing_id: destDirectory.driveId,
      dir_id: destDirectory._id
    },
    operation === 'copy'
  )
}

/**
 * Executes a move operation for files or folders.
 * Automatically detects if it's a shared drive operation and uses the appropriate API.
 *
 * @param {CozyClient} client - The cozy client instance
 * @param {import('@/components/FolderPicker/types').File} entry - The file or folder to move
 * @param {import('@/components/FolderPicker/types').File} sourceDirectory - The source directory containing the entry
 * @param {import('@/components/FolderPicker/types').File} destDirectory - The destination directory
 * @param {boolean} [force=false] - Whether to force the move operation
 * @returns {Promise<Object>} The result of the move operation
 */
export const executeMove = async (
  client,
  entry,
  sourceDirectory,
  destDirectory,
  force = false
) => {
  const isSharedDriveOperation = entry.driveId || destDirectory.driveId
  if (isSharedDriveOperation) {
    return await executeSharedDriveMoveOrCopy(
      client,
      entry,
      sourceDirectory,
      destDirectory
    )
  }
  return await move(client, entry, destDirectory, {
    force
  })
}

/**
 * Handles paste operations (copy or cut) for multiple files/folders.
 * Processes each file individually and handles validation, conflicts, and sharing permissions.
 *
 * @param {CozyClient} client - The cozy client instance
 * @param {Array<import('@/components/FolderPicker/types').File>} files - Array of files/folders to paste
 * @param {string | null} operation - The paste operation ('copy' or 'cut')
 * @param {import('@/components/FolderPicker/types').File} sourceDirectory - The source directory containing the files
 * @param {import('@/components/FolderPicker/types').File} targetFolder - The target folder for the paste operation
 * @param {Object} [options={}] - Additional options
 * @param {Function} [options.showAlert] - Function to show user alerts
 * @param {Function} [options.t] - Translation function
 * @param {unknown} [options.sharingContext] - Sharing context for validation
 * @param {Function} [options.showMoveValidationModal] - Function to show move validation modals
 * @param {boolean} [options.isPublic] - Whether the target folder is in public view
 * @returns {Promise<Array<{ success: boolean; file: import('@/components/FolderPicker/types').File; error?: Error; operation: string }>>} Array of operation results with success/failure status
 */
export const handlePasteOperation = async (
  client,
  files,
  operation,
  sourceDirectory,
  targetFolder,
  options = {}
) => {
  const { showAlert, t, sharingContext, isPublic } = options
  const results = []

  // For cut operations, resolve name conflicts first
  let processedFiles = files
  if (operation === 'cut') {
    processedFiles = await resolveNameConflictsForCut(
      client,
      files,
      targetFolder,
      isPublic
    )
  }

  const isCopyOperation = operation === 'copy'
  const isCutOperation = operation === 'cut'

  let hasValidatedMove = false

  for (const file of processedFiles) {
    try {
      if (isCopyOperation) {
        if (!isFile(file)) continue

        const result = await handleDuplicateWithValidation(
          client,
          file,
          targetFolder,
          { showAlert, t }
        )
        results.push({ success: true, file: result, operation: 'copy' })
      } else if (isCutOperation) {
        const shouldValidateMove = !hasValidatedMove
        if (shouldValidateMove) {
          hasValidatedMove = true
        }

        const result = await handleMoveWithValidation(
          client,
          file,
          sourceDirectory,
          targetFolder,
          {
            sharingContext: shouldValidateMove ? sharingContext : null,
            showMoveValidationModal: shouldValidateMove
              ? options.showMoveValidationModal
              : null
          }
        )
        results.push({ success: true, file: result, operation: 'move' })
      }
    } catch (error) {
      results.push({ success: false, file, error, operation })
    }
  }

  return results
}

/**
 * Handles file duplication (copy operation) with validation and user feedback.
 * Shows success alerts and handles Nextcloud query refreshing.
 *
 * @param {CozyClient} client - The cozy client instance
 * @param {import('@/components/FolderPicker/types').File} file - The file to duplicate
 * @param {import('@/components/FolderPicker/types').File} targetFolder - The target folder for duplication
 * @param {Object} [options={}] - Additional options
 * @param {Function} [options.showAlert] - Function to show user alerts
 * @param {Function} [options.t] - Translation function
 * @returns {Promise<Object>} The duplicated file object
 */
const handleDuplicateWithValidation = async (
  client,
  file,
  targetFolder,
  options = {}
) => {
  const { showAlert, t } = options

  const result = await copy(client, file, targetFolder)

  const isCopyingInsideNextcloud = targetFolder._type === NEXTCLOUD_FILE_ID
  if (isCopyingInsideNextcloud) {
    refreshNextcloudQueries(client, targetFolder)
  }

  if (showAlert && t) {
    showAlert({
      message: t('DuplicateModal.success', {
        smart_count: 1,
        fileName: file.name,
        destinationName:
          targetFolder._id === ROOT_DIR_ID
            ? t('breadcrumb.title_drive')
            : targetFolder.name
      }),
      severity: 'success'
    })
  }

  return result
}

/**
 * Creates a promisified move operation with user confirmation modal.
 *
 * @param {Function} showMoveValidationModal - Function to show validation modal
 * @param {string} modalType - Type of modal to show
 * @param {import('@/components/FolderPicker/types').File} file - File to move
 * @param {import('@/components/FolderPicker/types').File} targetFolder - Target folder
 * @param {CozyClient} client - Cozy client instance
 * @param {import('@/components/FolderPicker/types').File} sourceDirectory - Source directory
 * @returns {Promise<Object>} Promise that resolves with move result
 */
const createMoveWithConfirmation = (
  showMoveValidationModal,
  modalType,
  file,
  targetFolder,
  client,
  sourceDirectory
) => {
  return new Promise((resolve, reject) => {
    const executeConfirmedMove = async () => {
      try {
        const result = await executeMove(
          client,
          file,
          sourceDirectory,
          targetFolder,
          true
        )
        resolve(result)
      } catch (error) {
        reject(error)
      }
    }

    const cancelMove = () => reject(new Error('Move cancelled by user'))

    showMoveValidationModal(
      modalType,
      file,
      targetFolder,
      executeConfirmedMove,
      cancelMove
    )
  })
}

/**
 * Determines the sharing context for a file and target folder.
 *
 * @param {import('@/components/FolderPicker/types').File} file - File to analyze
 * @param {import('@/components/FolderPicker/types').File} targetFolder - Target folder
 * @param {Object} sharingContext - Sharing context with helper functions
 * @returns {Object} Sharing analysis result
 */
const analyzeSharingContext = (file, targetFolder, sharingContext) => {
  const { getSharedParentPath, hasSharedParent, byDocId } = sharingContext

  const sharedParentPath = file.path ? getSharedParentPath(file.path) : ''
  const targetPath = joinPath(targetFolder.path, file.name)

  const areMovedFilesShared = hasOneOfEntriesShared([file], byDocId)
  const isOriginParentShared =
    hasSharedParent(file.path || '') || !!file.driveId
  const isTargetShared =
    hasSharedParent(targetPath || '') ||
    (!!targetFolder.driveId && targetFolder.driveId !== file.driveId)
  const isInsideSameSharedFolder =
    (sharedParentPath && targetPath.startsWith(sharedParentPath)) ||
    (!!file.driveId &&
      !!targetFolder.driveId &&
      file.driveId === targetFolder.driveId)

  return {
    areMovedFilesShared,
    isOriginParentShared,
    isTargetShared,
    isInsideSameSharedFolder
  }
}

/**
 * Handles sharing validation and shows appropriate modals if needed.
 *
 * @param {import('@/components/FolderPicker/types').File} file - File to move
 * @param {import('@/components/FolderPicker/types').File} targetFolder - Target folder
 * @param {Object} sharingContext - Sharing context
 * @param {Function} showMoveValidationModal - Modal function
 * @param {CozyClient} client - Cozy client
 * @param {import('@/components/FolderPicker/types').File} sourceDirectory - Source directory
 * @returns {Promise<Object>|null} Move result or null if no validation needed
 */
const handleSharingValidation = async (
  file,
  targetFolder,
  sharingContext,
  showMoveValidationModal,
  client,
  sourceDirectory
) => {
  const { getSharedParentPath, hasSharedParent, byDocId } = sharingContext

  const needsSharingValidation =
    (getSharedParentPath && hasSharedParent && byDocId) ||
    !!file.driveId ||
    !!targetFolder.driveId

  if (!needsSharingValidation) return null

  try {
    const sharingAnalysis = analyzeSharingContext(
      file,
      targetFolder,
      sharingContext
    )
    const {
      areMovedFilesShared,
      isOriginParentShared,
      isTargetShared,
      isInsideSameSharedFolder
    } = sharingAnalysis

    if (isInsideSameSharedFolder) return null

    if (isOriginParentShared && !isTargetShared) {
      return createMoveWithConfirmation(
        showMoveValidationModal,
        'moveOutside',
        file,
        targetFolder,
        client,
        sourceDirectory
      )
    }

    if (!areMovedFilesShared && isTargetShared) {
      return createMoveWithConfirmation(
        showMoveValidationModal,
        'moveInside',
        file,
        targetFolder,
        client,
        sourceDirectory
      )
    }

    if (areMovedFilesShared && isTargetShared) {
      return createMoveWithConfirmation(
        showMoveValidationModal,
        'moveSharedInside',
        file,
        targetFolder,
        client,
        sourceDirectory
      )
    }
  } catch (error) {
    logger.error('Failed to validate sharing context:', error)
  }

  return null
}

/**
 * Handles file renaming if needed.
 *
 * @param {CozyClient} client - Cozy client instance
 * @param {import('@/components/FolderPicker/types').File} file - File to rename
 */
const handleFileRename = async (client, file) => {
  if (!file.needsRename) return

  await client.collection(DOCTYPE_FILES).update({
    ...file,
    name: file.uniqueName,
    _rev: file._rev || file.meta.rev
  })
}

/**
 * Handles Nextcloud query refresh after move operations.
 *
 * @param {CozyClient} client - Cozy client instance
 * @param {import('@/components/FolderPicker/types').File} file - Moved file
 * @param {import('@/components/FolderPicker/types').File} targetFolder - Target folder
 */
const handleNextcloudRefresh = (client, file, targetFolder) => {
  const isMovingInsideNextcloud = targetFolder._type === NEXTCLOUD_FILE_ID
  const isMovingOutsideNextcloud =
    !isMovingInsideNextcloud && file._type === NEXTCLOUD_FILE_ID

  if (isMovingInsideNextcloud || isMovingOutsideNextcloud) {
    refreshNextcloudQueries(client, targetFolder, file, {
      isMovingInsideNextcloud,
      isMovingOutsideNextcloud
    })
  }
}

/**
 * Handles file/folder move operations with comprehensive sharing validation.
 * Checks for shared folder boundaries and shows appropriate validation modals.
 * Handles name conflicts and Nextcloud integration.
 *
 * @param {CozyClient} client - The cozy client instance
 * @param {import('@/components/FolderPicker/types').File} file - The file or folder to move
 * @param {import('@/components/FolderPicker/types').File} sourceDirectory - The source directory containing the file
 * @param {import('@/components/FolderPicker/types').File} targetFolder - The target folder for the move
 * @param {Object} [options={}] - Additional options
 * @param {Object} [options.sharingContext] - Sharing context for validation
 * @param {Function} [options.showMoveValidationModal] - Function to show move validation modals
 * @returns {Promise<Object>} The moved file/folder object
 */
const handleMoveWithValidation = async (
  client,
  file,
  sourceDirectory,
  targetFolder,
  options = {}
) => {
  const { sharingContext, showMoveValidationModal } = options

  const canValidateSharing =
    sharingContext &&
    (file.path || file.driveId) &&
    targetFolder.path &&
    showMoveValidationModal

  if (canValidateSharing) {
    const validationResult = await handleSharingValidation(
      file,
      targetFolder,
      sharingContext,
      showMoveValidationModal,
      client,
      sourceDirectory
    )

    if (validationResult !== null) {
      return validationResult
    }
  }

  await handleFileRename(client, file)

  const result = await executeMove(client, file, sourceDirectory, targetFolder)

  handleNextcloudRefresh(client, file, targetFolder)

  return result
}

/**
 * Refreshes Nextcloud queries after move/copy operations.
 *
 * @param {CozyClient} client - The cozy client instance
 * @param {import('@/components/FolderPicker/types').File} targetFolder - The target folder of the operation
 * @param {import('@/components/FolderPicker/types').File | null} [sourceFile=null] - The source file (for move operations)
 * @param {Object} [options={}] - Additional options
 * @param {boolean} [options.isMovingInsideNextcloud=false] - Whether moving into Nextcloud
 * @param {boolean} [options.isMovingOutsideNextcloud=false] - Whether moving out of Nextcloud
 */
const refreshNextcloudQueries = (
  client,
  targetFolder,
  sourceFile = null,
  options = {}
) => {
  const { isMovingInsideNextcloud = false, isMovingOutsideNextcloud = false } =
    options

  if (isMovingInsideNextcloud || targetFolder._type === NEXTCLOUD_FILE_ID) {
    const queryId = computeNextcloudFolderQueryId({
      sourceAccount: targetFolder.cozyMetadata?.sourceAccount,
      path: targetFolder.path
    })
    client?.resetQuery(queryId)
  }

  if (isMovingOutsideNextcloud && sourceFile) {
    const queryId = computeNextcloudFolderQueryId({
      sourceAccount: sourceFile.cozyMetadata?.sourceAccount,
      path: sourceFile.path
    })
    client?.resetQuery(queryId)
  }
}
