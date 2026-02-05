import cx from 'classnames'
import React, {
  forwardRef,
  useCallback,
  useMemo,
  useRef,
  useState
} from 'react'

import { useVaultClient } from 'cozy-keys-lib'
import VirtualizedGridList from 'cozy-ui/transpiled/react/GridList/Virtualized'
import virtuosoComponents from 'cozy-ui/transpiled/react/GridList/Virtualized/Dnd/virtuosoComponents'
import CustomDragLayer from 'cozy-ui/transpiled/react/utils/Dnd/CustomDrag/CustomDragLayer'

import GridWrapper from './GridWrapper'

import styles from '@/styles/filelist.styl'

import RightClickFileMenu from '@/components/RightClick/RightClickFileMenu'
import AddFolder from '@/modules/filelist/AddFolder'
import { GridFileWithSelection as GridFile } from '@/modules/filelist/virtualized/GridFile'
import useScrollToHighlightedItem from '@/modules/views/Folder/virtualized/useScrollToHighlightedItem'

const GridItem = forwardRef(({ item, context, ...props }, ref) => {
  const { componentProps } = context
  const DefaultItem = virtuosoComponents.Item

  return (
    <DefaultItem
      ref={ref}
      item={item}
      context={context}
      {...props}
      {...componentProps?.Item}
    />
  )
})

GridItem.displayName = 'GridItem'

const GridItemMemo = React.memo(GridItem)

const mergedComponents = {
  ...virtuosoComponents,
  List: GridWrapper,
  Item: GridItemMemo
}

const Grid = forwardRef(
  (
    {
      items,
      actions,
      withFilePath = false,
      refreshFolderContent,
      isSharingContextEmpty,
      isSharingShortcut = null,
      isReferencedByShareInSharingContext,
      sharingsValue,
      fetchMore,
      dragProps,
      currentFolderId,
      driveId,
      onInteractWithFile,
      selectedItems,
      isSelectedItem
    },
    ref
  ) => {
    const vaultClient = useVaultClient()
    const virtuosoRef = useRef(null)
    const [itemsInDropProcess, setItemsInDropProcess] = useState([])

    const componentProps = useMemo(
      () => ({
        Item: {
          className: cx(styles['fil-content-grid-item'])
        }
      }),
      []
    )

    const itemRenderer = useCallback(
      (file, { isOver }) => (
        <>
          {file.type != 'tempDirectory' ? (
            <RightClickFileMenu key={file?._id} doc={file} actions={actions}>
              <GridFile
                key={file?._id}
                attributes={file}
                withSelectionCheckbox
                withFilePath={withFilePath}
                actions={actions}
                refreshFolderContent={refreshFolderContent}
                isInSyncFromSharing={
                  !isSharingContextEmpty &&
                  isSharingShortcut?.(file) &&
                  isReferencedByShareInSharingContext(file, sharingsValue)
                }
                isOver={isOver}
                onInteractWithFile={onInteractWithFile}
              />
            </RightClickFileMenu>
          ) : (
            <AddFolder
              vaultClient={vaultClient}
              currentFolderId={currentFolderId}
              refreshFolderContent={refreshFolderContent}
              driveId={driveId}
            />
          )}
        </>
      ),
      [
        actions,
        withFilePath,
        refreshFolderContent,
        isSharingContextEmpty,
        isSharingShortcut,
        isReferencedByShareInSharingContext,
        sharingsValue,
        onInteractWithFile,
        vaultClient,
        currentFolderId,
        driveId
      ]
    )

    const gridContext = useMemo(
      () => ({
        actions,
        selectedItems,
        isSelectedItem,
        dragProps,
        itemRenderer,
        itemsInDropProcess,
        componentProps,
        setItemsInDropProcess,
        items
      }),
      [
        actions,
        selectedItems,
        isSelectedItem,
        dragProps,
        itemRenderer,
        itemsInDropProcess,
        componentProps,
        items
      ]
    )

    useScrollToHighlightedItem(virtuosoRef, items)

    return (
      <div
        className="u-h-100"
        ref={ref}
        tabIndex={0}
        style={{ outline: 'none' }}
      >
        {dragProps?.dragId && <CustomDragLayer dragId={dragProps.dragId} />}
        <VirtualizedGridList
          ref={virtuosoRef}
          components={mergedComponents}
          items={items}
          endReached={fetchMore}
          context={gridContext}
        />
      </div>
    )
  }
)

Grid.displayName = 'Grid'

export default React.memo(Grid)
