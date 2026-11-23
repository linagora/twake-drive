import PropTypes from 'prop-types'
import React, { useCallback, useEffect } from 'react'

import useFlag from 'cozy-flags/dist/useFlag'

import { isTrashedDocument } from './documents'

import { isItemTypeDisplayed } from '@/components/FilePicker/helpers'
import { usePersonalRecents } from '@/hooks/usePersonalRecents'
import useRecentFiles from '@/hooks/useRecentFiles'
import { isUnreadableRecent } from '@/modules/filelist/helpers'
import { useSelectionContext } from '@/modules/selection/SelectionProvider'

const RecentsContent = ({
  items,
  fetchStatus,
  hasMore,
  fetchMore,
  renderContent,
  rootBreadcrumbPath,
  isItemDisabled,
  getItemDisabledReason
}) => {
  const { selectedItems, setIsSelectAll, setSelectedItems } =
    useSelectionContext()

  useEffect(() => {
    if (fetchStatus === 'loading') return

    const itemIds = new Set(items.map(item => item._id))
    const remainingSelectedItems = selectedItems.filter(item =>
      itemIds.has(item._id)
    )

    if (remainingSelectedItems.length === selectedItems.length) return

    setSelectedItems(
      Object.fromEntries(remainingSelectedItems.map(item => [item._id, item]))
    )
    setIsSelectAll(false)
  }, [items, fetchStatus, selectedItems, setIsSelectAll, setSelectedItems])

  return renderContent({
    items,
    fetchStatus,
    hasMore,
    fetchMore,
    breadcrumbPath: [rootBreadcrumbPath],
    isItemDisabled,
    getItemDisabledReason,
    withFilePath: true,
    isFetchingMore: fetchStatus === 'loading' && items.length > 0,
    keepItemsOnError: true,
    emptyMessageKey: 'FilePicker.recents.empty',
    errorMessageKey: 'FilePicker.recents.error'
  })
}

const DataProxyRecentsContent = props => {
  const { data, fetchStatus } = useRecentFiles()

  return (
    <RecentsContent
      {...props}
      items={data ?? []}
      fetchStatus={fetchStatus}
      hasMore={false}
      fetchMore={null}
    />
  )
}

const PersonalRecentsContent = ({
  displayedTypes,
  isItemIncluded,
  ...props
}) => {
  const isVisible = useCallback(
    item =>
      !isUnreadableRecent(item) &&
      !isTrashedDocument(item) &&
      isItemTypeDisplayed(item, displayedTypes) &&
      isItemIncluded(item),
    [displayedTypes, isItemIncluded]
  )
  const { data, fetchStatus, hasMore, fetchMore } = usePersonalRecents({
    isVisible
  })

  return (
    <RecentsContent
      {...props}
      items={data}
      fetchStatus={fetchStatus}
      hasMore={hasMore}
      fetchMore={fetchMore}
    />
  )
}

export const FilePickerRecentsContent = ({
  displayedTypes,
  isItemIncluded,
  ...props
}) => {
  // The intents load the flags after the first render: follow their changes.
  const hasPersonalRecents = useFlag('drive.recents.enabled')

  return hasPersonalRecents ? (
    <PersonalRecentsContent
      {...props}
      displayedTypes={displayedTypes}
      isItemIncluded={isItemIncluded}
    />
  ) : (
    <DataProxyRecentsContent {...props} />
  )
}

FilePickerRecentsContent.propTypes = {
  renderContent: PropTypes.func.isRequired,
  rootBreadcrumbPath: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired
  }).isRequired,
  displayedTypes: PropTypes.arrayOf(PropTypes.string),
  isItemIncluded: PropTypes.func,
  isItemDisabled: PropTypes.func,
  getItemDisabledReason: PropTypes.func
}

FilePickerRecentsContent.defaultProps = {
  displayedTypes: [],
  isItemIncluded: () => true,
  isItemDisabled: () => false,
  getItemDisabledReason: () => null
}
