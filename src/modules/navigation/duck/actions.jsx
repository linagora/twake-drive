import React from 'react'

import { isDirectory } from 'cozy-client/dist/models/file'
import { resetQuery as resetQueryAction } from 'cozy-client/dist/store'
import flag from 'cozy-flags'
import { QuotaPaywall } from 'cozy-ui-plus/dist/Paywall'

import {
  ROOT_DIR_ID,
  TRASH_DIR_ID,
  FILES_FETCH_LIMIT,
  MAX_PAYLOAD_SIZE_IN_GB,
  MAX_UPLOAD_FILE_COUNT
} from '@/constants/config'
import { getEntriesTypeTranslated } from '@/lib/entries'
import logger from '@/lib/logger'
import { showModal } from '@/lib/react-cozy-helpers'
import { getFolderContent, getFolderContentQueries } from '@/modules/selectors'
import { addToUploadQueue, extractFilesEntries } from '@/modules/upload'
import UploadLimitDialog from '@/modules/upload/UploadLimitDialog'

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
 * Reset folder queries so the server re-sends proper paginated data.
 * Works around cozy-client's sortAndLimitDocsIds capping realtime-added
 * documents to `limit * fetchedPagesCount`, which hides files beyond
 * the first page and leaves hasMore stale.
 */
const refetchFolderQueries = async (client, folderId) => {
  try {
    const storeState = client.store.getState()
    const matchingQueries = getFolderContentQueries(storeState, folderId)

    await Promise.all(
      matchingQueries.map(async queryState => {
        if (!queryState?.definition) return
        // Clear stale pagination state then fetch every page
        client.dispatch(resetQueryAction(queryState.id))
        await client.queryAll(queryState.definition, { as: queryState.id })
      })
    )
  } catch (error) {
    logger.error('Failed to refetch folder queries after upload:', error)
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
    { client, showAlert, t },
    driveId,
    addItems
  ) =>
  async dispatch => {
    let targetDirId = dirId
    let navigateAfterUpload = false

    if (dirId === null || dirId === undefined || dirId === TRASH_DIR_ID) {
      targetDirId = ROOT_DIR_ID
      navigateAfterUpload = true
    }

    const maxFileCount =
      flag('drive.max-upload-file-count') ?? MAX_UPLOAD_FILE_COUNT

    // Extract entries synchronously before browser clears dataTransfer
    const entries = extractFilesEntries(files)

    dispatch(
      addToUploadQueue(
        entries,
        targetDirId,
        sharingState,
        fileUploadedCallback,
        ({
          createdItems,
          quotas,
          conflicts,
          networkErrors,
          errors,
          unreadableErrors,
          updatedItems,
          fileTooLargeErrors
        }) => {
          dispatch(
            uploadQueueProcessed(
              createdItems,
              quotas,
              conflicts,
              networkErrors,
              errors,
              unreadableErrors,
              updatedItems,
              showAlert,
              t,
              fileTooLargeErrors,
              navigateAfterUpload,
              addItems
            )
          )
          if (createdItems.length + updatedItems.length >= FILES_FETCH_LIMIT) {
            refetchFolderQueries(client, targetDirId)
          }
        },
        {
          client,
          maxFileCount,
          onLimitExceeded: () =>
            dispatch(
              showModal(<UploadLimitDialog maxFileCount={maxFileCount} />)
            )
        },
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
    unreadableErrors,
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
      unreadableErrors: unreadableErrors.map(f => f.name),
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
        severity: 'error',
        duration: null,
        noClickAway: true
      })
    } else if (unreadableErrors.length > 0) {
      logger.warn(
        `Upload module triggers an unreadable files error: ${unreadableErrors}`
      )
      showAlert({
        message: t('upload.alert.unreadable_files'),
        severity: 'error',
        duration: null,
        noClickAway: true
      })
    } else if (errors.length > 0) {
      logger.error(`Upload module triggers an error: ${errors}`)
      showAlert({
        message: t('upload.alert.errors', { type }),
        severity: 'error',
        duration: null,
        noClickAway: true
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
        severity: 'error',
        duration: null,
        noClickAway: true
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
  name,
  currentFolderId,
  { showAlert, t } = {},
  driveId,
  addItems = () => {}
) => {
  const safeAddItems = typeof addItems === 'function' ? addItems : () => {}
  return async (dispatch, getState) => {
    const state = getState()
    let targetFolderId = currentFolderId
    let navigateAfterCreate = false

    if (
      currentFolderId === null ||
      currentFolderId === undefined ||
      currentFolderId === TRASH_DIR_ID
    ) {
      targetFolderId = ROOT_DIR_ID
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

    let createdFolder
    try {
      createdFolder = await client
        .collection('io.cozy.files', { driveId })
        .create({
          name: name,
          dirId: targetFolderId,
          type: 'directory'
        })

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
