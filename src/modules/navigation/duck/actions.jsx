import React from 'react'

import { isDirectory } from 'cozy-client/dist/models/file'
import flag from 'cozy-flags'
import { QuotaPaywall } from 'cozy-ui-plus/dist/Paywall'

import { ROOT_DIR_ID, TRASH_DIR_ID } from '@/constants/config'
import { MAX_PAYLOAD_SIZE_IN_GB } from '@/constants/config'
import { createEncryptedDir } from '@/lib/encryption'
import { getEntriesTypeTranslated } from '@/lib/entries'
import logger from '@/lib/logger'
import { showModal } from '@/lib/react-cozy-helpers'
import { getFolderContent } from '@/modules/selectors'
import { addToUploadQueue } from '@/modules/upload'

export const SORT_FOLDER = 'SORT_FOLDER'
export const OPERATION_REDIRECTED = 'navigation/OPERATION_REDIRECTED'

const HTTP_CODE_CONFLICT = 409

export const operationRedirected = () => ({ type: OPERATION_REDIRECTED })

export const sortFolder = (folderId, sortAttribute, sortOrder = 'asc') => {
  return {
    type: SORT_FOLDER,
    folderId,
    sortAttribute,
    sortOrder
  }
}

/**
 * Upload files to the given directory
 * @param {Array} files - The list of File objects to upload
 * @param {string} dirId - The id of the directory in which we upload the files
 * @param {Object} sharingState - The sharing context (provided by SharingContext.Provider)
 * @param {function} fileUploadedCallback - A callback called when a file is uploaded
 * @param {Object} options - An object containing the following properties:
 *   - client - The cozy-client instance
 *   - vaultClient - The vault client
 *   - showAlert - A function to show an alert
 *   - t - A translation function
 * @param {string|undefined} driveId - The id of the drive in which we upload the files
 * @param {function|undefined} addItems - Callback to add newly uploaded items to the context.
 */
export const uploadFiles =
  (
    files,
    dirId,
    sharingState,
    fileUploadedCallback = () => null,
    { client, vaultClient, showAlert, t },
    driveId,
    addItems
  ) =>
  dispatch => {
    let targetDirId = dirId
    let navigateAfterUpload = false

    if (dirId === null || dirId === undefined || dirId === TRASH_DIR_ID) {
      targetDirId = ROOT_DIR_ID
      navigateAfterUpload = true
    }

    dispatch(
      addToUploadQueue(
        files,
        targetDirId,
        sharingState,
        fileUploadedCallback,
        ({
          createdItems,
          quotas,
          conflicts,
          networkErrors,
          errors,
          updatedItems,
          fileTooLargeErrors
        }) =>
          dispatch(
            uploadQueueProcessed(
              createdItems,
              quotas,
              conflicts,
              networkErrors,
              errors,
              updatedItems,
              showAlert,
              t,
              fileTooLargeErrors,
              navigateAfterUpload,
              addItems
            )
          ),
        { client, vaultClient },
        driveId,
        addItems
      )
    )
  }

const uploadQueueProcessed =
  (
    created,
    quotas,
    conflicts,
    networkErrors,
    errors,
    updated,
    showAlert,
    t,
    fileTooLargeErrors,
    navigateAfterUpload,
    addItems
  ) =>
  dispatch => {
    const safeAddItems = typeof addItems === 'function' ? addItems : () => {}
    const conflictCount = conflicts.length
    const createdCount = created.length
    const updatedCount = updated.length
    const type = getEntriesTypeTranslated(t, [
      ...created,
      ...updated,
      ...conflicts
    ])

    // Add new items to the NewContext
    const successfulUploads = [...created, ...updated]
    if (successfulUploads.length > 0) {
      safeAddItems(successfulUploads)
    }

    // Add logging to debug upload completion
    logger.debug('uploadQueueProcessed called with:', {
      created: created.map(f => f.name),
      updated: updated.map(f => f.name),
      quotas: quotas.map(f => f.name),
      conflicts: conflicts.map(f => f.name),
      networkErrors: networkErrors.map(f => f.name),
      errors: errors.map(f => ({
        name: f.name,
        status: f.status,
        message: f.message
      })),
      fileTooLargeErrors: fileTooLargeErrors.map(f => f.name),
      navigateAfterUpload
    })

    if (quotas.length > 0) {
      logger.warn(`Upload module triggers a quota alert: ${quotas}`)
      dispatch(
        showModal(<QuotaPaywall isIapEnabled={flag('flagship.iap.enabled')} />)
      )
    } else if (networkErrors.length > 0) {
      logger.warn(`Upload module triggers a network error: ${networkErrors}`)
      showAlert({
        message: t('upload.alert.network'),
        severity: 'secondary'
      })
    } else if (errors.length > 0) {
      logger.error(`Upload module triggers an error: ${errors}`)
      // Show more detailed error message
      const errorMessages = errors
        .map(err => err.message || JSON.stringify(err))
        .join(', ')
      showAlert({
        message: t('upload.alert.errors_detailed', {
          type,
          count: errors.length,
          details: errorMessages
        }),
        severity: 'secondary'
      })
    } else if (updatedCount > 0 && createdCount > 0 && conflictCount > 0) {
      showAlert({
        message: t('upload.alert.success_updated_conflicts', {
          smart_count: createdCount,
          updatedCount,
          conflictCount,
          type
        }),
        severity: 'success'
      })
    } else if (updatedCount > 0 && createdCount > 0) {
      showAlert({
        message: t('upload.alert.success_updated', {
          smart_count: createdCount,
          updatedCount,
          type
        }),
        severity: 'success'
      })
    } else if (updatedCount > 0 && conflictCount > 0) {
      showAlert({
        message: t('upload.alert.updated_conflicts', {
          smart_count: updatedCount,
          conflictCount,
          type
        }),
        severity: 'success'
      })
    } else if (conflictCount > 0) {
      showAlert({
        message: t('upload.alert.success_conflicts', {
          smart_count: createdCount,
          conflictNumber: conflictCount,
          type
        }),
        severity: 'secondary'
      })
    } else if (updatedCount > 0 && createdCount === 0) {
      showAlert({
        message: t('upload.alert.updated', {
          smart_count: updatedCount,
          type
        }),
        severity: 'success'
      })
    } else if (fileTooLargeErrors.length > 0) {
      showAlert({
        message: t('upload.alert.fileTooLargeErrors', {
          max_size_value: MAX_PAYLOAD_SIZE_IN_GB
        }),
        severity: 'error'
      })
    } else {
      showAlert({
        message: t('upload.alert.success', {
          smart_count: createdCount,
          type
        }),
        severity: 'success'
      })
    }

    const hasSuccessfulUploads = created.length > 0 || updated.length > 0

    if (navigateAfterUpload && hasSuccessfulUploads) {
      logger.debug('Dispatching operationRedirected for upload.')
      dispatch(operationRedirected())
    } else {
      logger.debug('Not dispatching operationRedirected for upload.', {
        navigateAfterUpload,
        hasSuccessfulUploads
      })
    }
  }

/**
 * Given a folderId, checks the current known state to return if
 * a folder with the same name exist in the given folderId.
 *
 * The local state can be incomplete so this can return false
 * negatives.
 */
const doesFolderExistByName = (state, parentFolderId, name) => {
  const filesInCurrentView = getFolderContent(state, parentFolderId) || [] // TODO in the public view we don't use a query, so getFolderContent returns null. We could look inside the cozy-client store with a predicate to find folders with a matching dir_id.

  const existingFolder = filesInCurrentView.find(f => {
    return isDirectory(f) && f.name === name
  })

  return Boolean(existingFolder)
}

/**
 * Creates a folder in the current view
 */
export const createFolder = (
  client,
  vaultClient,
  name,
  currentFolderId,
  { isEncryptedFolder = false, showAlert, t } = {},
  driveId,
  addItems = () => {}
) => {
  const safeAddItems = typeof addItems === 'function' ? addItems : () => {}
  return async (dispatch, getState) => {
    const state = getState()
    let targetFolderId = currentFolderId
    let isTargetEncrypted = isEncryptedFolder
    let navigateAfterCreate = false

    if (
      currentFolderId === null ||
      currentFolderId === undefined ||
      currentFolderId === TRASH_DIR_ID
    ) {
      targetFolderId = ROOT_DIR_ID
      isTargetEncrypted = false
      navigateAfterCreate = true
    }

    const existingFolder = doesFolderExistByName(state, targetFolderId, name)

    if (existingFolder) {
      showAlert({
        message: t('alert.folder_name', { folderName: name }),
        severity: 'error'
      })
      throw new Error('alert.folder_name')
    }

    let createdFolder = null
    try {
      if (!isTargetEncrypted) {
        createdFolder = await client
          .collection('io.cozy.files', { driveId })
          .create({
            name: name,
            dirId: targetFolderId,
            type: 'directory'
          })
      } else {
        if (targetFolderId === currentFolderId) {
          createdFolder = await createEncryptedDir(client, vaultClient, {
            name,
            dirID: targetFolderId,
            driveId
          })
        } else {
          logger.error(
            'Attempted to create encrypted folder in non-original/root target.'
          )
          throw new Error(
            'Cannot create encrypted folder in root via redirection.'
          )
        }
      }

      // Add newly created folder to new items
      if (createdFolder) {
        safeAddItems([createdFolder.data])
      }

      if (navigateAfterCreate && createdFolder) {
        dispatch(operationRedirected())
      }
    } catch (err) {
      if (err.response && err.response.status === HTTP_CODE_CONFLICT) {
        showAlert({
          message: t('alert.folder_name', { folderName: name }),
          severity: 'error'
        })
      } else {
        showAlert({ message: t('alert.folder_generic'), severity: 'error' })
      }
      throw err
    }
  }
}
