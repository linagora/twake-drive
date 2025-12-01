import cx from 'classnames'
import React, { useCallback } from 'react'

import { useVaultClient } from 'cozy-keys-lib'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'

import styles from '@/styles/folder-view.styl'

import { EmptyDrive } from '@/components/Error/Empty'
import Oops from '@/components/Error/Oops'
import RightClickFileMenu from '@/components/RightClick/RightClickFileMenu'
import { useFolderSort } from '@/hooks'
import { useThumbnailSizeContext } from '@/lib/ThumbnailSizeContext'
import { useViewSwitcherContext } from '@/lib/ViewSwitcherContext'
import AddFolder from '@/modules/filelist/AddFolder'
import { FileWithSelection as File } from '@/modules/filelist/File'
import { FileList } from '@/modules/filelist/FileList'
import FileListBody from '@/modules/filelist/FileListBody'
import { FileListHeader } from '@/modules/filelist/FileListHeader'
import FileListRowsPlaceholder from '@/modules/filelist/FileListRowsPlaceholder'
import LoadMore from '@/modules/filelist/LoadMoreV2'
import { useNeedsToWait } from '@/modules/folder/hooks/useNeedsToWait'
import { useScrollToTop } from '@/modules/folder/hooks/useScrollToTop'
import SelectionBar from '@/modules/selection/SelectionBar'

/**
 * Renders the body of a folder, displaying the list of files and folders within it.
 *
 * @component
 * @param {Object} props - The component props.
 * @param {string} props.folderId - The ID of the folder.
 * @param {Array} props.queryResults - The results of the queries for the folder content.
 * @param {Object} [props.actions] - The actions available for the folder.
 * @param {import('modules/certifications/useExtraColumns').ExtraColumn[]} props.extraColumns - The extra columns to display in the file list.
 * @param {boolean} [props.canSort] - Indicates whether sorting is enabled for the file list.
 * @param {Function} [props.refreshFolderContent] - The function to refresh the folder content.
 * @param {boolean} [props.withFilePath] - Indicates whether to display the file path.
 * @param {boolean} [props.isInSyncFromSharing] - Indicates whether the folder is in sync from sharing.
 * @param {Function} [props.renderEmptyComponent] - The function to render the empty component.
 * @param {Function} [props.canInteractWith] - Indicates whether the user can interact with the file.
 */
const FolderBody = ({
  folderId,
  queryResults,
  actions,
  extraColumns,
  canSort,
  refreshFolderContent,
  withFilePath,
  isInSyncFromSharing,
  renderEmptyComponent = () => {
    return <EmptyDrive />
  },
  canInteractWith,
  driveId
}) => {
  const vaultClient = useVaultClient()
  const { isDesktop } = useBreakpoints()

  useScrollToTop(folderId)

  const [sortOrder, setSortOrder, isSettingsLoaded] = useFolderSort(folderId)

  const isError = queryResults.some(query => query.fetchStatus === 'failed')
  const hasData =
    !isError && queryResults.some(query => query.data && query.data.length > 0)
  const isLoading =
    !hasData &&
    queryResults.some(
      query => query.fetchStatus === 'loading' && !query.lastUpdate
    ) &&
    !isSettingsLoaded
  const isEmpty = !isError && !isLoading && !hasData
  const needsToWait = useNeedsToWait({ isLoading })

  const { isBigThumbnail } = useThumbnailSizeContext()
  const { viewType, switchView } = useViewSwitcherContext()

  const changeSortOrder = useCallback(
    (folderId_legacy, attribute, order) => setSortOrder({ attribute, order }),
    [setSortOrder]
  )

  return (
    <>
      <SelectionBar actions={actions} />
      <FileList>
        {hasData ? (
          <FileListHeader
            folderId={null}
            canSort={canSort}
            sort={sortOrder}
            onFolderSort={changeSortOrder}
            switchViewType={switchView}
            viewType={viewType}
          />
        ) : null}
        <FileListBody selectionModeActive={false}>
          {!hasData && !needsToWait && (
            <div
              className={cx(
                viewType === 'grid' ? styles['fil-folder-body-grid'] : '',
                {
                  'u-ov-hidden': !isDesktop
                }
              )}
            >
              <AddFolder
                vaultClient={vaultClient}
                refreshFolderContent={refreshFolderContent}
                extraColumns={extraColumns}
                currentFolderId={folderId}
                driveId={driveId}
              />
            </div>
          )}
          {isError ? <Oops /> : null}
          {isLoading || needsToWait ? <FileListRowsPlaceholder /> : null}
          {isEmpty ? renderEmptyComponent() : null}
          {hasData && !needsToWait ? (
            <div
              className={cx(
                viewType === 'grid' ? styles['fil-folder-body-grid'] : '',
                {
                  'u-ov-hidden': !isDesktop
                }
              )}
            >
              <AddFolder
                vaultClient={vaultClient}
                refreshFolderContent={refreshFolderContent}
                extraColumns={extraColumns}
                currentFolderId={folderId}
                driveId={driveId}
              />
              {queryResults.map((query, queryIndex) => (
                <React.Fragment key={queryIndex}>
                  {query.data.map(file => {
                    return (
                      <RightClickFileMenu
                        key={file._id}
                        doc={file}
                        actions={actions}
                      >
                        <File
                          key={file._id}
                          attributes={file}
                          withFilePath={withFilePath}
                          thumbnailSizeBig={isBigThumbnail}
                          actions={actions}
                          refreshFolderContent={refreshFolderContent}
                          isInSyncFromSharing={isInSyncFromSharing}
                          extraColumns={extraColumns}
                          withSelectionCheckbox
                          canInteractWith={canInteractWith}
                        />
                      </RightClickFileMenu>
                    )
                  })}
                  {query.hasMore && <LoadMore fetchMore={query.fetchMore} />}
                </React.Fragment>
              ))}
            </div>
          ) : null}
        </FileListBody>
      </FileList>
    </>
  )
}

export { FolderBody }
