import React, { useState, useEffect, useMemo } from 'react'
import { useSelector } from 'react-redux'

import { useBreakpoints } from 'cozy-ui/transpiled/react/providers/Breakpoints'

import FolderViewBodyContent from './FolderViewBodyContent'
import { makeColumns } from '../helpers'

import { EmptyWrapper } from '@/components/Error/Empty'
import Oops from '@/components/Error/Oops'
import { useThumbnailSizeContext } from '@/lib/ThumbnailSizeContext'
import FileListRowsPlaceholder from '@/modules/filelist/FileListRowsPlaceholder'
import { isTypingNewFolderName } from '@/modules/filelist/duck'
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

  const isInError = queryResults.some(query => query.fetchStatus === 'failed')
  const hasDataToShow =
    !isInError &&
    queryResults.some(query => query.data && query.data.length > 0)
  const isLoading =
    !hasDataToShow &&
    queryResults.some(
      query => query.fetchStatus === 'loading' && !query.lastUpdate
    )
  const isEmpty = !isInError && !isLoading && !hasDataToShow

  const columns = useMemo(() => makeColumns(isBigThumbnail), [isBigThumbnail])

  /**
   *  Since we are not able to restore the scroll correctly,
   * and force the scroll to top every time we change the
   * current folder. This is to avoid this kind of weird
   * behavior:
   * - If I go to a sub-folder, if this subfolder has a lot
   * of data and I scrolled down until the bottom. If I go
   * back, then my folder will also be scrolled down.
   *
   * This is an ugly hack, yeah.
   * */
  useEffect(() => {
    if (isDesktop) {
      const scrollable = document.querySelectorAll(
        '[data-testid=fil-content-body]'
      )[0]
      if (scrollable) {
        scrollable.scroll({ top: 0 })
      }
    } else {
      window.scroll({ top: 0 })
    }

    clearItems()
  }, [currentFolderId, isDesktop, clearItems])

  /**
   * When we mount the component when we already have data in cache,
   * the mount is time consuming since we'll render at least 100 lines
   * of File.
   *
   * React seems to batch together the fact that :
   * - we change a route
   * - we want to render 100 files
   * resulting in a non smooth transition between views (Drive / Recent / ...)
   *
   * In order to bypass this batch, we use a state to first display a much
   * more simpler component and then the files
   */
  const [needsToWait, setNeedsToWait] = useState(true)
  useEffect(() => {
    let timeout = null
    if (!isLoading) {
      timeout = setTimeout(() => {
        setNeedsToWait(false)
      }, 50)
    }
    return () => clearTimeout(timeout)
  }, [isLoading])

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
