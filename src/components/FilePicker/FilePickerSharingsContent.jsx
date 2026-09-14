import PropTypes from 'prop-types'

import { isSharingShortcutNew } from 'cozy-client/dist/models/file'
import { useSharingContext } from 'cozy-sharing'

import { isDisplayedItem } from './helpers'

import { DEFAULT_SORT } from '@/config/sort'
import { SHARING_TAB_WITH_ME } from '@/constants/config'
import { sortFiles } from '@/modules/views/Folder/sortFiles'
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
  isItemVisible,
  isItemDisabled: externalIsItemDisabled,
  getItemDisabledReason,
  sortOrder
}) => {
  const { allLoaded } = useSharingContext()
  const isItemDisabled = item =>
    isSharingShortcutNew(item) || externalIsItemDisabled(item)
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
      ? sortFiles(
          (filteredResult.data ?? [])
            .filter(
              item =>
                isDisplayedItem(item, displayedTypes) && isItemVisible(item)
            )
            .map(item => (item.type ? item : { ...item, type: 'file' })),
          sortOrder
        )
      : []

  return renderFilePickerContent({
    items,
    fetchStatus,
    hasMore: false,
    fetchMore: null,
    breadcrumbPath: [rootBreadcrumbPath],
    isItemDisabled,
    getItemDisabledReason,
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
  isItemVisible: PropTypes.func.isRequired,
  isItemDisabled: PropTypes.func,
  getItemDisabledReason: PropTypes.func,
  sortOrder: PropTypes.shape({
    attribute: PropTypes.string.isRequired,
    order: PropTypes.string.isRequired
  }).isRequired
}

FilePickerSharingsContent.defaultProps = {
  isItemVisible: () => true,
  isItemDisabled: () => false,
  getItemDisabledReason: () => null,
  sortOrder: DEFAULT_SORT
}
