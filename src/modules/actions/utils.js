import { isDirectory } from 'cozy-client/dist/models/file'
import { receiveQueryResult } from 'cozy-client/dist/store'

import { DOCTYPE_FILES } from '@/lib/doctypes'

const isMissingFileError = error => error.status === 404

const downloadFileError = error => {
  return isMissingFileError(error)
    ? 'error.download_file.missing'
    : 'error.download_file.offline'
}

/**
 * An instance of cozy-client
 * @typedef {object} CozyClient
 */

/**
 * downloadFiles - Triggers the download of one or multiple files by the browser
 *
 * @param {CozyClient} client
 * @param {array} files  One or more files to download
 */
export const downloadFiles = async (client, files, { showAlert, t } = {}) => {
  if (files.length === 1 && !isDirectory(files[0])) {
    const file = files[0]
    const driveId = file.driveId
    try {
      return await client
        .collection(DOCTYPE_FILES, { driveId })
        .download(file, null, file.name)
    } catch (error) {
      showAlert({ message: t(downloadFileError(error)), severity: 'error' })
    }
  } else {
    const ids = files.map(f => f.id)
    const driveId = files[0].driveId
    return client.collection(DOCTYPE_FILES, { driveId }).downloadArchive(ids)
  }
}

const isAlreadyInTrash = err => {
  const reasons = err.reason !== undefined ? err.reason.errors : undefined
  if (reasons) {
    for (const reason of reasons) {
      if (reason.detail === 'File or directory is already in the trash') {
        return true
      }
    }
  }
  return false
}

/**
 * trashFiles - Moves a set of files to the cozy trash
 *
 * @param {CozyClient} client
 * @param {array} files  One or more files to trash
 */
export const trashFiles = async (client, files, { showAlert, t, driveId }) => {
  try {
    for (const file of files) {
      // TODO we should not go through a FileCollection to destroy the file, but
      // only do client.destroy(), I do not know what it did not update the internal
      // store correctly when I tried
      const { data: updatedFile } = await client
        .collection(DOCTYPE_FILES, { driveId })
        .destroy(file)
      client.store.dispatch(
        receiveQueryResult(null, {
          data: updatedFile
        })
      )
      client.collection('io.cozy.permissions').revokeSharingLink(file)
    }

    showAlert({ message: t('alert.trash_file_success'), severity: 'success' })
  } catch (err) {
    if (!isAlreadyInTrash(err)) {
      showAlert({ message: t('alert.try_again'), severity: 'error' })
    }
  }
}

export const restoreFiles = async (client, files) => {
  for (const file of files) {
    await client.collection(DOCTYPE_FILES).restore(file.id)
  }
}
