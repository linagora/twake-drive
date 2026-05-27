import React, { useEffect, useMemo } from 'react'
import { useSelector } from 'react-redux'

import { useBreakpoints } from 'cozy-ui/transpiled/react/providers/Breakpoints'

import FolderViewBodyContent from './FolderViewBodyContent'
import { makeColumns } from '../helpers'
import { getFolderViewState } from '../hooks/getFolderViewState'

import { EmptyWrapper } from '@/components/Error/Empty'
import Oops from '@/components/Error/Oops'
import { useThumbnailSizeContext } from '@/lib/ThumbnailSizeContext'
import FileListRowsPlaceholder from '@/modules/filelist/FileListRowsPlaceholder'
import { isTypingNewFolderName } from '@/modules/filelist/duck'
import { useNeedsToWait } from '@/modules/folder/hooks/useNeedsToWait'
import { useScrollToTop } from '@/modules/folder/hooks/useScrollToTop'
import { useNewItemHighlightContext } from '@/modules/upload/NewItemHighlightProvider'
import AddFolderWrapper from '@/modules/views/Folder/virtualized/AddFolderWrapper'

const FolderViewBody = ({
  currentFolderId,
  displayedFolder,
  queryResults,
  actions,
  canUpload = true,
  canDrag,
  withFilePath = false,
  refreshFolderContent = null,
  driveId,
  orderProps = {
    sortOrder: {},
    setOrder: () => {},
    isSettingsLoaded: true
  }
}) => {
  const { isDesktop } = useBreakpoints()
  const IsAddingFolder = useSelector(isTypingNewFolderName)
  const { isBigThumbnail } = useThumbnailSizeContext()
  const { clearItems } = useNewItemHighlightContext()
  const { sortOrder, setOrder, isSettingsLoaded } = orderProps

  const { isInError, isLoading, isEmpty } = getFolderViewState({ queryResults })

  const columns = useMemo(() => makeColumns(isBigThumbnail), [isBigThumbnail])

  useScrollToTop(currentFolderId)
  // Reset the new-item-highlight tracker on folder change and on desktop /
  // mobile breakpoint transitions, matching the deps the original effect used
  // when it bundled the scroll-to-top and clearItems calls together.
  useEffect(() => {
    clearItems()
  }, [currentFolderId, isDesktop, clearItems])

  const needsToWait = useNeedsToWait({ isLoading })

  if (needsToWait || isLoading || !isSettingsLoaded) {
    return <FileListRowsPlaceholder />
  }

  if (isInError) {
    return <Oops />
  }

  /* TODO FolderViewBody should not have the responsability to chose
      which empty component to display. It should be done by the "view" itself.
      But adding a new prop like <FolderViewBody emptyComponent={}
      is not good enought too */
  if (isEmpty) {
    if (IsAddingFolder) {
      return (
        <AddFolderWrapper
          columns={columns}
          currentFolderId={currentFolderId}
          refreshFolderContent={refreshFolderContent}
          driveId={driveId}
        />
      )
    }

    return (
      <EmptyWrapper
        currentFolderId={currentFolderId}
        displayedFolder={displayedFolder}
        canUpload={canUpload}
        driveId={driveId}
        refreshFolderContent={refreshFolderContent}
      />
    )
  }

  return (
    <FolderViewBodyContent
      currentFolderId={currentFolderId}
      displayedFolder={displayedFolder}
      actions={actions}
      columns={columns}
      queryResults={queryResults}
      isEmpty={isEmpty}
      canDrag={canDrag}
      withFilePath={withFilePath}
      driveId={driveId}
      orderProps={{
        sortOrder,
        setOrder
      }}
      refreshFolderContent={refreshFolderContent}
    />
  )
}

export default FolderViewBody
