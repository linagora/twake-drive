import React from 'react'

import { Q, useClient } from 'cozy-client'

import FilePicker from './FilePicker'
import { getFilePickerConfig } from './FilePicker/config'
import { filePickerLinkModes } from './FilePicker/constants'
import { filePickerErrorCodes, makeFilePickerError } from './FilePicker/errors'
import { makeFilePickerFileEntry } from './FilePicker/payload'
import {
  getFileId,
  getOrCreateSharingLink,
  makeTemporaryDownloadLink
} from './FilePicker/sharing'

const Picker = ({ service, intent }) => {
  const client = useClient()
  const serviceData = service.getData?.()
  const filePickerConfig = getFilePickerConfig(intent, serviceData)

  const handleClose = () => {
    service.cancel()
  }

  const handlePick = async (fileId, linkMode) => {
    let file

    try {
      const { data } = await client.query(Q('io.cozy.files').getById(fileId))
      file = Array.isArray(data) ? (data[0] ?? null) : (data ?? null)
    } catch (error) {
      service.throw(
        makeFilePickerError(filePickerErrorCodes.ITEM_NOT_FOUND, {
          message: error instanceof Error ? error.message : String(error),
          id: fileId
        })
      )
      return null
    }

    if (!file) {
      service.throw(
        makeFilePickerError(filePickerErrorCodes.ITEM_NOT_FOUND, {
          message: 'Selected file could not be found',
          id: fileId
        })
      )
      return null
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
      service.throw(
        makeFilePickerError(
          linkMode === filePickerLinkModes.TEMPORARY_DOWNLOAD_LINK
            ? filePickerErrorCodes.DOWNLOAD_LINK_FAILED
            : filePickerErrorCodes.SHARING_LINK_FAILED,
          {
            message: error instanceof Error ? error.message : String(error),
            id: getFileId(file),
            fileName: file.name
          }
        )
      )
      return null
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
