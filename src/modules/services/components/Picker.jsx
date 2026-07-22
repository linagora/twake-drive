import React from 'react'

import { Q, useClient, fetchPolicies } from 'cozy-client'

import FilePicker from './FilePicker'
import { getFilePickerConfig } from './FilePicker/config'
import {
  filePickerDoubleClickResults,
  filePickerErrorCodes,
  filePickerLinkModes,
  filePickerSharingLinkStatuses
} from './FilePicker/constants'
import { makeFilePickerFileEntry } from './FilePicker/payload'
import {
  fetchExistingSharingLink,
  getFileId,
  getOrCreateSharingLink,
  makeTemporaryDownloadLinks
} from './FilePicker/sharing'

import logger from '@/lib/logger'

function terminateWithGeneratedSharingLinks(
  files,
  generatedSharingLinks,
  service
) {
  try {
    const linksByDocumentId = new Map(
      generatedSharingLinks.map(({ documentId, url }) => [documentId, url])
    )
    const entries = files.map(file => {
      const sharingLink = linksByDocumentId.get(getFileId(file))
      if (!sharingLink) {
        throw new Error('Missing generated sharing link')
      }
      return makeFilePickerFileEntry(file, { sharingLink })
    })

    service.terminate(entries)
    return null
  } catch (error) {
    logger.warn('FilePicker link generation failed', error)
    return filePickerErrorCodes.SHARING_LINK_FAILED
  }
}

const Picker = ({ service, intent, onReadyToUse }) => {
  const client = useClient()
  const serviceData = service.getData?.()
  const filePickerConfig = getFilePickerConfig(intent, serviceData)

  const handlePick = async (fileIds, linkMode, generatedSharingLinks) => {
    const selectedFiles = Array.isArray(fileIds) ? fileIds : [fileIds]
    const selectedFileIds = selectedFiles.map(file =>
      typeof file === 'string' ? file : getFileId(file)
    )
    let queryResults
    try {
      queryResults = await Promise.all(
        selectedFileIds.map(fileId =>
          client.query(Q('io.cozy.files').getById(fileId), {
            as: `picker-confirm-${fileId}`,
            // Always go to the network — the file might have been deleted
            // between listing and confirmation.
            fetchPolicy: fetchPolicies.olderThan(0)
          })
        )
      )
    } catch {
      return filePickerErrorCodes.ITEM_NOT_FOUND
    }

    const files = []
    for (const result of queryResults) {
      const data = result?.data
      if (!data) {
        return filePickerErrorCodes.ITEM_NOT_FOUND
      }
      files.push(data)
    }

    if (linkMode === filePickerLinkModes.PUBLIC_LINK && generatedSharingLinks) {
      return terminateWithGeneratedSharingLinks(
        files,
        generatedSharingLinks,
        service
      )
    }

    if (linkMode === filePickerLinkModes.REFERENCE) {
      try {
        service.terminate(
          files.map(file => makeFilePickerFileEntry(file, { reference: true }))
        )
        return null
      } catch (error) {
        logger.warn('FilePicker reference termination failed', error)
        return null
      }
    }

    try {
      if (linkMode === filePickerLinkModes.TEMPORARY_DOWNLOAD_LINK) {
        const downloadLinks = await makeTemporaryDownloadLinks(client, files)
        const entries = files.map((file, index) =>
          makeFilePickerFileEntry(file, { downloadLink: downloadLinks[index] })
        )

        service.terminate(entries)
        return null
      }

      const entries = await Promise.all(
        files.map(async file => {
          const sharingLink = await getOrCreateSharingLink(client, file)
          return makeFilePickerFileEntry(file, { sharingLink })
        })
      )

      service.terminate(entries)
      return null
    } catch (error) {
      logger.warn('FilePicker link generation failed', error)
      return linkMode === filePickerLinkModes.TEMPORARY_DOWNLOAD_LINK
        ? filePickerErrorCodes.DOWNLOAD_LINK_FAILED
        : filePickerErrorCodes.SHARING_LINK_FAILED
    }
  }

  const handleFileDoubleClick = async (file, linkMode) => {
    if (linkMode === filePickerLinkModes.TEMPORARY_DOWNLOAD_LINK) {
      return handlePick([file], linkMode)
    }

    try {
      const result = await fetchExistingSharingLink(client, file, {
        singleFileOnly: true
      })
      if (result.status === filePickerSharingLinkStatuses.FOUND) {
        return handlePick([file], filePickerLinkModes.PUBLIC_LINK, [
          { documentId: getFileId(file), url: result.url }
        ])
      }
      if (result.status === filePickerSharingLinkStatuses.NOT_FOUND) {
        return filePickerDoubleClickResults.OPEN_MODAL
      }
      return filePickerErrorCodes.SHARING_LINK_FAILED
    } catch {
      return filePickerErrorCodes.SHARING_LINK_FAILED
    }
  }

  return (
    <FilePicker
      onChange={handlePick}
      onFileDoubleClick={handleFileDoubleClick}
      filePickerConfig={filePickerConfig}
      onReadyToUse={onReadyToUse}
      multiple={filePickerConfig.multiple}
    />
  )
}

export default Picker
