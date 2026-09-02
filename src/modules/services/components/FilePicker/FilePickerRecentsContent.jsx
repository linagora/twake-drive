import PropTypes from 'prop-types'
import { useEffect } from 'react'

import useRecentFiles from '@/hooks/useRecentFiles'
import { useSelectionContext } from '@/modules/selection/SelectionProvider'

const isItemDisabled = () => false

export const FilePickerRecentsContent = ({
  renderContent,
  rootBreadcrumbPath
}) => {
  const { data, fetchStatus } = useRecentFiles()
  const { selectedItems, setIsSelectAll, setSelectedItems } =
    useSelectionContext()
  const items = data ?? []

  useEffect(() => {
    if (fetchStatus === 'loading') return

    const itemIds = new Set((data ?? []).map(item => item._id))
    const remainingSelectedItems = selectedItems.filter(item =>
      itemIds.has(item._id)
    )

    if (remainingSelectedItems.length === selectedItems.length) return

    setSelectedItems(
      Object.fromEntries(remainingSelectedItems.map(item => [item._id, item]))
    )
    setIsSelectAll(false)
  }, [data, fetchStatus, selectedItems, setIsSelectAll, setSelectedItems])

  return renderContent({
    items,
    fetchStatus,
    hasMore: false,
    fetchMore: null,
    breadcrumbPath: [rootBreadcrumbPath],
    isItemDisabled,
    withFilePath: true,
    isFetchingMore: fetchStatus === 'loading' && items.length > 0,
    keepItemsOnError: true,
    emptyMessageKey: 'FilePicker.recents.empty',
    errorMessageKey: 'FilePicker.recents.error'
  })
}

FilePickerRecentsContent.propTypes = {
  renderContent: PropTypes.func.isRequired,
  rootBreadcrumbPath: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired
  }).isRequired
}
