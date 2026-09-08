import PropTypes from 'prop-types'

import { isSharingShortcutNew } from 'cozy-client/dist/models/file'
import { useSharingContext } from 'cozy-sharing'

import { isDisplayedItem } from './helpers'

import { SHARING_TAB_WITH_ME } from '@/constants/config'
import { useFilteredSharings } from '@/modules/views/Sharings/useFilteredSharings'
import {
  getSharingsFetchStatus,
  useSharingsQueryResult
} from '@/modules/views/Sharings/useSharingsQueryResult'

export const FilePickerSharingsContent = ({
  renderFilePickerContent,
  rootBreadcrumbPath,
  sharedDocumentIds,
  displayedTypes,
  isItemVisible
}) => {
  const { allLoaded } = useSharingContext()
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

  const items =
    fetchStatus === 'loaded'
      ? (filteredResult.data ?? []).filter(
          item => isDisplayedItem(item, displayedTypes) && isItemVisible(item)
        )
      : []

  return renderFilePickerContent({
    items,
    fetchStatus,
    hasMore: false,
    fetchMore: null,
    breadcrumbPath: [rootBreadcrumbPath],
    isItemDisabled: isSharingShortcutNew,
    emptyMessageKey: 'empty.sharing_text'
  })
}

FilePickerSharingsContent.propTypes = {
  renderFilePickerContent: PropTypes.func.isRequired,
  rootBreadcrumbPath: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired
  }).isRequired,
  sharedDocumentIds: PropTypes.arrayOf(PropTypes.string).isRequired,
  displayedTypes: PropTypes.arrayOf(PropTypes.string).isRequired,
  isItemVisible: PropTypes.func.isRequired
}

FilePickerSharingsContent.defaultProps = {
  isItemVisible: () => true
}
