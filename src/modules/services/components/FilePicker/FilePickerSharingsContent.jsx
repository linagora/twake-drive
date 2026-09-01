import PropTypes from 'prop-types'
import { useMemo } from 'react'

import { isSharingShortcutNew } from 'cozy-client/dist/models/file'
import { useSharingContext } from 'cozy-sharing'

import { SHARING_TAB_WITH_ME } from '@/constants/config'
import { useFilteredSharings } from '@/modules/views/Sharings/useFilteredSharings'
import {
  getSharingsFetchStatus,
  useSharingsQueryResult
} from '@/modules/views/Sharings/useSharingsQueryResult'

export const FilePickerSharingsContent = ({
  renderFilePickerContent,
  rootBreadcrumbPath
}) => {
  const { allLoaded, byDocId } = useSharingContext()
  const sharedDocumentIds = useMemo(() => Object.keys(byDocId ?? {}), [byDocId])
  const sharingsResult = useSharingsQueryResult(sharedDocumentIds, allLoaded)
  const { filteredResult, sharedDrivesLoaded, sharedDrivesError } =
    useFilteredSharings({
      result: sharingsResult,
      sharedDocumentIds,
      tab: SHARING_TAB_WITH_ME
    })

  const fetchStatus = getSharingsFetchStatus({
    allLoaded,
    filteredResult,
    sharedDrivesLoaded,
    sharedDrivesError
  })

  return renderFilePickerContent({
    items: fetchStatus === 'loaded' ? (filteredResult.data ?? []) : [],
    fetchStatus,
    hasMore: false,
    fetchMore: null,
    breadcrumbPath: [rootBreadcrumbPath],
    isItemDisabled: isSharingShortcutNew
  })
}

FilePickerSharingsContent.propTypes = {
  renderFilePickerContent: PropTypes.func.isRequired,
  rootBreadcrumbPath: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired
  }).isRequired
}
