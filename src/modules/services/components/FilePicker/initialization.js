import { models } from 'cozy-client'
import logger from 'cozy-logger'

import { fetchPickerDocument } from './documents'

import {
  filePickerSections,
  FILE_PICKER_RECENTS_ROOT_ID,
  FILE_PICKER_SHARINGS_ROOT_ID
} from '@/components/FilePicker/constants'
import { buildContentFolderQuery } from '@/components/FilePicker/queries'
import { ROOT_DIR_ID } from '@/constants/config'

export async function initializeFilePicker(client, config) {
  const sections = Object.values(filePickerSections)
  if (
    !Array.isArray(config.tabs) ||
    config.tabs.length === 0 ||
    config.tabs.some(tab => !sections.includes(tab)) ||
    (config.restrictToDefaultDir && config.tabs.some(tab => tab !== 'drive'))
  ) {
    throw new Error('Invalid File Picker tabs')
  }
  const tabs = sections.filter(section => config.tabs.includes(section))
  if (
    config.restrictToDefaultDir &&
    (typeof config.defaultDirId !== 'string' || !config.defaultDirId)
  ) {
    throw new Error('A restricted File Picker requires defaultDirId')
  }

  const section = tabs[0]
  let folderId =
    section === filePickerSections.DRIVE
      ? ROOT_DIR_ID
      : section === filePickerSections.RECENTS
        ? FILE_PICKER_RECENTS_ROOT_ID
        : FILE_PICKER_SHARINGS_ROOT_ID
  let restrictedRoot = null
  if (section === filePickerSections.DRIVE && config.defaultDirId !== null) {
    if (typeof config.defaultDirId !== 'string' || !config.defaultDirId) {
      throw new Error('defaultDirId must be a local folder ID')
    }
    let folder = null
    let resolutionError = null
    try {
      folder = await fetchPickerDocument(client, config.defaultDirId)
    } catch (error) {
      resolutionError = error
    }
    if (
      folder &&
      (folder.driveId || (folder._type && folder._type !== 'io.cozy.files'))
    ) {
      throw new Error('defaultDirId must be local')
    }
    if (!folder || !models.file.isDirectory(folder) || folder.trashed) {
      const error =
        resolutionError || new Error('defaultDirId is not an accessible folder')
      if (config.restrictToDefaultDir) throw error
      logger.warn(
        'File Picker starting folder unavailable; using Drive root',
        error
      )
    } else {
      folderId = config.defaultDirId
      if (config.restrictToDefaultDir) {
        restrictedRoot = { id: folderId, name: folder.name }
      }
    }
  }

  if (section === filePickerSections.DRIVE) {
    const query = buildContentFolderQuery(folderId)
    try {
      await client.query(query.definition(), query.options)
    } catch (error) {
      if (config.restrictToDefaultDir) throw error
      logger.warn('File Picker folder prefetch failed', error)
    }
  }
  return {
    ...config,
    tabs,
    initialLocation: { section, folderId, driveId: null },
    restrictedRoot
  }
}
