import React from 'react'

import { Q, useClient, fetchPolicies } from 'cozy-client'

import FilePicker from './FilePicker'
import { getFilePickerConfig } from './FilePicker/config'
import {
  filePickerErrorCodes,
  filePickerLinkModes
} from './FilePicker/constants'
import { makeFilePickerFileEntry } from './FilePicker/payload'
import {
  getOrCreateSharingLink,
  makeTemporaryDownloadLink
} from './FilePicker/sharing'

import logger from '@/lib/logger'

const Picker = ({ service, intent }) => {
  const client = useClient()
  const serviceData = service.getData?.()
  const filePickerConfig = getFilePickerConfig(intent, serviceData)

  const handleClose = () => {
    service.cancel()
  }

  const handlePick = async (fileId, linkMode) => {
    let file = null
    try {
      const { data } = await client.query(Q('io.cozy.files').getById(fileId), {
        as: `picker-confirm-${fileId}`,
        // Always go to the network — the file might have been deleted
        // between listing and confirmation.
        fetchPolicy: fetchPolicies.olderThan(0)
      })
      file = data ?? null
    } catch {
      // file stays null
    }

    if (!file) {
      return filePickerErrorCodes.ITEM_NOT_FOUND
    }

    try {
      if (linkMode === filePickerLinkModes.TEMPORARY_DOWNLOAD_LINK) {
        const downloadLink = await makeTemporaryDownloadLink(client, file)

        service.terminate([makeFilePickerFileEntry(file, { downloadLink })])
        return null
      }

      // Try to reuse an existing sharing link before creating a new one
      const sharingLink = await getOrCreateSharingLink(client, file)

      service.terminate([makeFilePickerFileEntry(file, { sharingLink })])
      return null
    } catch (error) {
      logger.warn('FilePicker link generation failed', error)
      return linkMode === filePickerLinkModes.TEMPORARY_DOWNLOAD_LINK
        ? filePickerErrorCodes.DOWNLOAD_LINK_FAILED
        : filePickerErrorCodes.SHARING_LINK_FAILED
    }
  }

  return (
    <FilePicker
      onChange={handlePick}
      onClose={handleClose}
      filePickerConfig={filePickerConfig}
    />
  )
}

export default Picker
