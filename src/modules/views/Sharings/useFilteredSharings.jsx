import { useMemo } from 'react'

import flag from 'cozy-flags'

import { SHARED_DRIVES_DIR_ID } from '@/constants/config'
import { useTransformFolderListHasSharedDriveShortcuts } from '@/hooks/useTransformFolderListHasSharedDriveShortcuts'

const buildBaseShape = (result, hasIds) => ({
  ...result,
  fetchStatus: hasIds ? result.fetchStatus : 'loaded',
  lastFetch: hasIds ? result.lastFetch : Date.now()
})

const getDocId = item => item._id ?? item.id
const isSharedDrivesDirItem = item => item.dir_id === SHARED_DRIVES_DIR_ID
const shouldReplaceItem = (current, candidate) =>
  isSharedDrivesDirItem(current) && !isSharedDrivesDirItem(candidate)

/**
 * Drops duplicate representations of the same file/folder.
 *
 * During transient sharing updates, the Sharings view can receive the same
 * document twice: once as the real Drive entry and once as a transformed
 * shared-drive entry. The transformed entry has `dir_id` set to the
 * shared-drives magic directory, which renders as `/sharings` in the list.
 * Keep the real Drive entry whenever it is available so the row path matches
 * the stable state after a page reload.
 */
export const deduplicateSharingShortcuts = data => {
  if (!data?.length) return data

  const indexByDocId = new Map()
  const deduplicatedData = []
  let hasDuplicates = false

  for (const item of data) {
    const docId = getDocId(item)
    if (!docId) {
      deduplicatedData.push(item)
      continue
    }

    const existingIndex = indexByDocId.get(docId)
    if (existingIndex === undefined) {
      indexByDocId.set(docId, deduplicatedData.length)
      deduplicatedData.push(item)
      continue
    }

    hasDuplicates = true
    if (shouldReplaceItem(deduplicatedData[existingIndex], item)) {
      deduplicatedData[existingIndex] = item
    }
  }

  return hasDuplicates ? deduplicatedData : data
}

const computeData = ({
  result,
  withoutSharedDrives,
  transformedSharedDrives,
  nonSharedDriveList
}) => {
  let data
  if (withoutSharedDrives) {
    data =
      result.data?.filter(item => item.dir_id !== SHARED_DRIVES_DIR_ID) || []
  } else {
    data = [...transformedSharedDrives, ...nonSharedDriveList]
  }
  return deduplicateSharingShortcuts(data)
}

/**
 * Reshapes the raw sharings query result for the Sharings view.
 *
 * Drops the magic shared-drives directory when shared-drive and federated
 * shared-folder flags are both off, otherwise merges transformed shared-drive
 * shortcuts into the result. Then drops transient duplicate representations of
 * the same document, preferring the real Drive entry over the shared-drives
 * synthetic entry.
 */
export const useFilteredSharings = ({ result, sharedDocumentIds }) => {
  const isEnabledSharedDrive = flag('drive.shared-drive.enabled')
  const isEnabledFederatedSharedFolder = flag(
    'drive.federated-shared-folder.enabled'
  )
  const withoutSharedDrives =
    !isEnabledSharedDrive && !isEnabledFederatedSharedFolder

  const {
    sharedDrives: transformedSharedDrives,
    nonSharedDriveList,
    sharedDrivesLoaded
  } = useTransformFolderListHasSharedDriveShortcuts(result.data)

  const filteredResult = useMemo(() => {
    const hasIds = sharedDocumentIds?.length > 0
    const data = computeData({
      result,
      withoutSharedDrives,
      transformedSharedDrives,
      nonSharedDriveList
    })
    return { ...buildBaseShape(result, hasIds), data, count: data.length }
  }, [
    withoutSharedDrives,
    transformedSharedDrives,
    nonSharedDriveList,
    result,
    sharedDocumentIds?.length
  ])

  // When shared drives are disabled the view ignores the transformed list,
  // so don't block the page on that hook's load state.
  return {
    filteredResult,
    sharedDrivesLoaded: withoutSharedDrives || sharedDrivesLoaded
  }
}
