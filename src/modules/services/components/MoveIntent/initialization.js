import {
  fetchPickerDocument,
  fetchPickerDocumentWithPath
} from '../FilePicker/documents'
import { getIntentData, getPickerNavigationConfig } from '../intentConfig'
import { initializePickerNavigation } from '../pickerNavigation'

import { isNextcloudFile } from '@/modules/nextcloud/helpers'

const MOVE_TABS = ['drive', 'sharings']

export function getMoveIntentConfig(intent, serviceData = null) {
  const data = getIntentData(intent, serviceData) || {}
  return {
    ...getPickerNavigationConfig(data, MOVE_TABS),
    fileIds: data.fileIds ?? null
  }
}

function hasValidSourceIds(fileIds) {
  return (
    Array.isArray(fileIds) &&
    fileIds.length > 0 &&
    fileIds.every(id => typeof id === 'string' && Boolean(id.trim()))
  )
}

function hasValidMoveTabs(tabs) {
  return (
    Array.isArray(tabs) &&
    tabs.includes('drive') &&
    tabs.every(tab => MOVE_TABS.includes(tab))
  )
}

function isLocalSource(document) {
  return (
    !document.driveId &&
    !document.orgDrive &&
    !document.driveOwner &&
    !isNextcloudFile(document) &&
    document.cozyMetadata?.createdByApp !== 'nextcloud'
  )
}

function isAccessibleSource(document, id) {
  return (
    document &&
    document._id === id &&
    document._type === 'io.cozy.files' &&
    document.type === 'file' &&
    !document.trashed &&
    !document._deleted &&
    isLocalSource(document)
  )
}

async function fetchMoveSource(client, id) {
  const document = await fetchPickerDocument(client, id)
  if (!isAccessibleSource(document, id)) {
    throw new Error('MOVE sources must be accessible local files')
  }
  return fetchPickerDocumentWithPath(client, document)
}

export async function initializeMoveIntent(client, config) {
  if (!hasValidSourceIds(config.fileIds)) {
    throw new Error('MOVE requires a non-empty array of local file IDs')
  }
  if (!hasValidMoveTabs(config.tabs)) {
    throw new Error(
      'Invalid MOVE tabs: Drive is required; Recents is not supported'
    )
  }

  const entries = await Promise.all(
    [...new Set(config.fileIds)].map(id => fetchMoveSource(client, id))
  )
  const navigation = await initializePickerNavigation(client, config)
  return { ...navigation, entries }
}
