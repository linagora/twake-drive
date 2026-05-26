import cx from 'classnames'
import React, { useContext, useRef } from 'react'
import { useSelector } from 'react-redux'

import { isSharingShortcut } from 'cozy-client/dist/models/file'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'

import { useFileSorting } from './hooks/useFileSorting'
import { getFolderViewState } from './hooks/getFolderViewState'
import { useSyncingFakeFile } from './useSyncingFakeFile'

import styles from '@/styles/folder-view.styl'

import { EmptyWrapper } from '@/components/Error/Empty'
import Oops from '@/components/Error/Oops'
import RightClickFileMenu from '@/components/RightClick/RightClickFileMenu'
import { useShiftSelection } from '@/hooks/useShiftSelection'
import AcceptingSharingContext from '@/lib/AcceptingSharingContext'
import { useThumbnailSizeContext } from '@/lib/ThumbnailSizeContext'
import { useViewSwitcherContext } from '@/lib/ViewSwitcherContext'
import AddFolder from '@/modules/filelist/AddFolder'
import { FileWithSelection as File } from '@/modules/filelist/File'
import { FileList } from '@/modules/filelist/FileList'
import FileListBody from '@/modules/filelist/FileListBody'
import { FileListHeader } from '@/modules/filelist/FileListHeader'
import FileListRowsPlaceholder from '@/modules/filelist/FileListRowsPlaceholder'
import LoadMore from '@/modules/filelist/LoadMoreV2'
import { isTypingNewFolderName } from '@/modules/filelist/duck'
import { useNeedsToWait } from '@/modules/folder/hooks/useNeedsToWait'
import { useScrollToTop } from '@/modules/folder/hooks/useScrollToTop'
import SelectionBar from '@/modules/selection/SelectionBar'
import { isReferencedByShareInSharingContext } from '@/modules/views/Folder/syncHelpers'

const FileListBodyWrapper = ({ viewType, children }) => {
  return (
    <div
      className={cx(viewType === 'grid' ? styles['fil-folder-body-grid'] : '')}
    >
      {children}
    </div>
  )
}

const FolderViewBody = ({
  currentFolderId,
  displayedFolder,
  queryResults,
  actions,
  canSort,
  canUpload = true,
  withFilePath = false,
  refreshFolderContent = null,
  orderProps,
  driveId
}) => {
  const { isDesktop } = useBreakpoints()
  const { viewType, switchView } = useViewSwitcherContext()
  const folderViewRef = useRef()
  const IsAddingFolder = useSelector(isTypingNewFolderName)

  const { sortOrder, isSettingsLoaded, sortedFiles, changeSortOrder } =
    useFileSorting(currentFolderId, queryResults, orderProps)

  const { setLastInteractedItem, onShiftClick } = useShiftSelection(
    { items: sortedFiles, viewType },
    folderViewRef
  )

  useScrollToTop(currentFolderId)

  const { isBigThumbnail } = useThumbnailSizeContext()
  const { sharingsValue } = useContext(AcceptingSharingContext)

  const { isInError, isLoading, isEmpty, hasDataToShow } = getFolderViewState({
    queryResults,
    isSettingsLoaded
  })
  const showEmpty = displayedFolder !== null && !IsAddingFolder && isEmpty
  const isSharingContextEmpty = Object.keys(sharingsValue).length <= 0

  const { syncingFakeFile } = useSyncingFakeFile({ isEmpty, queryResults })

  const onToggleSelect = (fileId, e) => {
    setLastInteractedItem(fileId)
    onShiftClick(fileId, e)
  }

  const needsToWait = useNeedsToWait({ isLoading })

  return (
    <>
      <SelectionBar actions={actions} />
      <FileList ref={folderViewRef}>
        {hasDataToShow && (
          <FileListHeader
            folderId={null}
            canSort={canSort}
            sort={sortOrder}
            onFolderSort={changeSortOrder}
            viewType={viewType}
            switchViewType={switchView}
          />
        )}
        <FileListBody selectionModeActive={false}>
          {!hasDataToShow && !needsToWait && (
            <FileListBodyWrapper viewType={viewType} isDesktop={isDesktop}>
              <AddFolder
                refreshFolderContent={refreshFolderContent}
                currentFolderId={currentFolderId}
              />
            </FileListBodyWrapper>
          )}
          {isInError && <Oops />}
          {(needsToWait || isLoading) && <FileListRowsPlaceholder />}
          {/* TODO FolderViewBody should not have the responsability to chose
          which empty component to display. It should be done by the "view" itself.
          But adding a new prop like <FolderViewBody emptyComponent={}
          is not good enought too */}
          {showEmpty && (
            <EmptyWrapper
              currentFolderId={currentFolderId}
              canUpload={canUpload}
              driveId={driveId}
            />
          )}
          {hasDataToShow && !needsToWait && (
            <FileListBodyWrapper viewType={viewType} isDesktop={isDesktop}>
              <>
                {syncingFakeFile && (
                  <File
                    attributes={syncingFakeFile}
                    withSelectionCheckbox={false}
                    actions={[]}
                    isInSyncFromSharing={true}
                    disableSelection={true}
                  />
                )}
                <AddFolder
                  refreshFolderContent={refreshFolderContent}
                  currentFolderId={currentFolderId}
                />
                {sortedFiles.map(file => {
                  return (
                    <RightClickFileMenu
                      key={file._id}
                      doc={file}
                      actions={actions}
                    >
                      <File
                        key={file._id}
                        attributes={file}
                        withSelectionCheckbox
                        withFilePath={withFilePath}
                        thumbnailSizeBig={isBigThumbnail}
                        actions={actions}
                        refreshFolderContent={refreshFolderContent}
                        isInSyncFromSharing={
                          !isSharingContextEmpty &&
                          isSharingShortcut(file) &&
                          isReferencedByShareInSharingContext(
                            file,
                            sharingsValue
                          )
                        }
                        onToggleSelect={e => {
                          onToggleSelect(file?._id, e)
                        }}
                      />
                    </RightClickFileMenu>
                  )
                })}
                {queryResults.some(query => query.hasMore) && (
                  <LoadMore
                    fetchMore={() => {
                      queryResults.forEach(query => {
                        if (query.hasMore && query.fetchMore) {
                          query.fetchMore()
                        }
                      })
                    }}
                  />
                )}
              </>
            </FileListBodyWrapper>
          )}
        </FileListBody>
      </FileList>
    </>
  )
}

export default FolderViewBody
