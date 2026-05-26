import { useMemo } from 'react'

import flag from 'cozy-flags'

import { SHARED_DRIVES_DIR_ID } from '@/constants/config'
import { useTransformFolderListHasSharedDriveShortcuts } from '@/hooks/useTransformFolderListHasSharedDriveShortcuts'

const buildBaseShape = (result, hasIds) => ({
  ...result,
  fetchStatus: hasIds ? result.fetchStatus : 'loaded',
  lastFetch: hasIds ? result.lastFetch : Date.now()
})

const computeData = ({
  result,
  withoutSharedDrives,
  transformedSharedDrives,
  nonSharedDriveList
}) => {
  if (withoutSharedDrives) {
    return (
      result.data?.filter(item => item.dir_id !== SHARED_DRIVES_DIR_ID) || []
    )
  }
  return [...transformedSharedDrives, ...nonSharedDriveList]
}

/**
 * Reshapes the raw sharings query result for the Sharings view.
 *
 * Drops the magic shared-drives directory when shared-drive and federated
 * shared-folder flags are both off, otherwise merges transformed shared-drive
 * shortcuts into the result. Returns the combined `filteredResult` plus the
 * `sharedDrivesLoaded` flag the view uses to gate its placeholder.
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
