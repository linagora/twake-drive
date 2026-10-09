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

function getFilePickerTabs(config) {
  const sections = config.restrictToDefaultDir
    ? [filePickerSections.DRIVE]
    : Object.values(filePickerSections)
  if (!Array.isArray(config.tabs) || config.tabs.length === 0) {
    throw new Error('Invalid File Picker tabs')
  }
  if (config.tabs.some(tab => !sections.includes(tab))) {
    throw new Error('Invalid File Picker tabs')
  }
  return sections.filter(section => config.tabs.includes(section))
}

function isValidDefaultDirId(id) {
  return typeof id === 'string' && Boolean(id)
}

function hasLocalFileScope(folder) {
  return !folder.driveId && (!folder._type || folder._type === 'io.cozy.files')
}

function findLocalStartingFolder(folder) {
  if (!folder) return null
  if (!hasLocalFileScope(folder)) throw new Error('defaultDirId must be local')
  if (!models.file.isDirectory(folder) || folder.trashed) return null
  return folder
}

async function fetchStartingFolder(client, config) {
  if (!isValidDefaultDirId(config.defaultDirId)) {
    throw new Error('defaultDirId must be a local folder ID')
  }
  let folder = null
  let resolutionError = null
  try {
    folder = await fetchPickerDocument(client, config.defaultDirId)
  } catch (error) {
    resolutionError = error
  }
  const localFolder = findLocalStartingFolder(folder)
  if (localFolder) return localFolder

  const error =
    resolutionError || new Error('defaultDirId is not an accessible folder')
  if (config.restrictToDefaultDir) throw error
  logger.warn(
    'File Picker starting folder unavailable; using Drive root',
    error
  )
  return null
}

async function prefetchStartingFolder(client, folderId, restrictToDefaultDir) {
  const query = buildContentFolderQuery(folderId)
  try {
    await client.query(query.definition(), query.options)
  } catch (error) {
    if (restrictToDefaultDir) throw error
    logger.warn('File Picker folder prefetch failed', error)
  }
}

function getRestrictedRoot(folderId, folder, restrictToDefaultDir) {
  return restrictToDefaultDir && folder
    ? { id: folderId, name: folder.name }
    : null
}

export async function initializeFilePicker(client, config) {
  const tabs = getFilePickerTabs(config)
  if (
    config.restrictToDefaultDir &&
    !isValidDefaultDirId(config.defaultDirId)
  ) {
    throw new Error('A restricted File Picker requires defaultDirId')
  }

  const section = tabs[0]
  let folderId = {
    [filePickerSections.DRIVE]: ROOT_DIR_ID,
    [filePickerSections.RECENTS]: FILE_PICKER_RECENTS_ROOT_ID,
    [filePickerSections.SHARINGS]: FILE_PICKER_SHARINGS_ROOT_ID
  }[section]
  let folder = null
  if (section === filePickerSections.DRIVE && config.defaultDirId !== null) {
    folder = await fetchStartingFolder(client, config)
    if (folder) folderId = config.defaultDirId
  }
  const restrictedRoot = getRestrictedRoot(
    folderId,
    folder,
    config.restrictToDefaultDir
  )

  if (section === filePickerSections.DRIVE) {
    await prefetchStartingFolder(client, folderId, config.restrictToDefaultDir)
  }
  return {
    ...config,
    tabs,
    initialLocation: { section, folderId, driveId: null },
    restrictedRoot
  }
}
