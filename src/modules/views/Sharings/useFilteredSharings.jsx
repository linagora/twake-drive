import { useMemo } from 'react'

import { isSharingShortcut } from 'cozy-client/dist/models/file'
import flag from 'cozy-flags'
import { useSharingContext } from 'cozy-sharing'

import {
  SHARED_DRIVES_DIR_ID,
  SHARING_TAB_BY_ME,
  SHARING_TAB_DRIVES,
  SHARING_TAB_WITH_ME
} from '@/constants/config'
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

// The regular Drive row wins deduplication for display, but only the
// transformed entry carries the driveId/orgDrive/driveOwner attributes the
// tab classification needs; backfill them onto the surviving row.
const withDriveMetadata = (kept, dropped) =>
  !kept.driveId && dropped.driveId
    ? {
        ...kept,
        driveId: dropped.driveId,
        orgDrive: dropped.orgDrive,
        driveOwner: dropped.driveOwner
      }
    : kept

/**
 * Drops duplicate representations of the same file/folder.
 *
 * During transient sharing updates, the Sharings view can receive the same
 * document twice: once as the real Drive entry and once as a transformed
 * shared-drive entry. The transformed entry has `dir_id` set to the
 * shared-drives magic directory, which renders as `/sharings` in the list.
 * Keep the real Drive entry whenever it is available so the row path matches
 * the stable state after a page reload, while retaining the drive
 * classification metadata of the discarded transformed entry.
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
    const existing = deduplicatedData[existingIndex]
    deduplicatedData[existingIndex] = shouldReplaceItem(existing, item)
      ? withDriveMetadata(item, existing)
      : withDriveMetadata(existing, item)
  }

  return hasDuplicates ? deduplicatedData : data
}

/**
 * Returns the sharings tab a list entry belongs to.
 *
 * Shared-drive entries carry `driveId` plus the `orgDrive`/`driveOwner`
 * flags stamped from the sharing doc by
 * useTransformFolderListHasSharedDriveShortcuts. Pending invitation
 * shortcuts must be resolved before `isOwner`: cozy-sharing's `isOwner`
 * answers true for documents it has no sharing for, which would misfile
 * them under "shared by me".
 *
 * @param {object} entry - File-like entry from the sharings list
 * @param {(docId: string) => boolean} isOwner - From cozy-sharing's useSharingContext
 * @returns {string} One of the SHARING_TAB_* constants
 */
export const getSharingsTabForEntry = (entry, isOwner) => {
  if (entry.driveId) {
    if (entry.orgDrive) return SHARING_TAB_DRIVES
    return entry.driveOwner ? SHARING_TAB_BY_ME : SHARING_TAB_WITH_ME
  }
  if (isSharingShortcut(entry)) return SHARING_TAB_WITH_ME
  return isOwner(getDocId(entry)) ? SHARING_TAB_BY_ME : SHARING_TAB_WITH_ME
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
 * synthetic entry. When `tab` is provided, keeps only the entries belonging
 * to that tab (see getSharingsTabForEntry).
 *
 * Also exposes `hasDrives`: whether any entry classifies onto the drives
 * tab, computed from the same deduplicated list regardless of the active
 * tab, so the view can hide the Team drives tab while it has no content.
 */
export const useFilteredSharings = ({ result, sharedDocumentIds, tab }) => {
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

  const { isOwner } = useSharingContext()

  const { filteredResult, hasDrives } = useMemo(() => {
    const hasIds = sharedDocumentIds?.length > 0
    // Filter by tab only after deduplication so each document lands in
    // exactly one tab.
    const combined = computeData({
      result,
      withoutSharedDrives,
      transformedSharedDrives,
      nonSharedDriveList
    })
    const data = tab
      ? combined.filter(entry => getSharingsTabForEntry(entry, isOwner) === tab)
      : combined
    return {
      filteredResult: {
        ...buildBaseShape(result, hasIds),
        data,
        count: data.length
      },
      hasDrives: combined.some(
        entry => getSharingsTabForEntry(entry, isOwner) === SHARING_TAB_DRIVES
      )
    }
  }, [
    withoutSharedDrives,
    transformedSharedDrives,
    nonSharedDriveList,
    result,
    sharedDocumentIds?.length,
    tab,
    isOwner
  ])

  // When shared drives are disabled the view ignores the transformed list,
  // so don't block the page on that hook's load state.
  return {
    filteredResult,
    hasDrives,
    sharedDrivesLoaded: withoutSharedDrives || sharedDrivesLoaded
  }
}
