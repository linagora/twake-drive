import React, { useMemo } from 'react'
import { Outlet, useParams } from 'react-router-dom'

import flag from 'cozy-flags'
import {
  useSharingContext,
  useNativeFileSharing,
  shareNative
} from 'cozy-sharing'
import { makeActions } from 'cozy-ui/transpiled/react/ActionsMenu/Actions'

import HarvestBanner from './HarvestBanner'
import { useDriveQueries } from './useDriveQueries'

import useHead from '@/components/useHead'
import { ROOT_DIR_ID } from '@/constants/config'
import { useClipboardContext } from '@/contexts/ClipboardProvider'
import { useCurrentFolderId, useDisplayedFolder, useFolderSort } from '@/hooks'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useThumbnailSizeContext } from '@/lib/ThumbnailSizeContext'
import {
  share,
  download,
  trash,
  rename,
  infos,
  versions,
  hr,
  selectAllItems,
  summariseByAI,
  signWithEuDss,
  verifyWithEuDss
} from '@/modules/actions'
import { addToFavorites } from '@/modules/actions/components/addToFavorites'
import { duplicateTo } from '@/modules/actions/components/duplicateTo'
import { moveTo } from '@/modules/actions/components/moveTo'
import { personalizeFolder } from '@/modules/actions/components/personalizeFolder'
import { removeFromFavorites } from '@/modules/actions/components/removeFromFavorites'
import AddMenuProvider from '@/modules/drive/AddMenu/AddMenuProvider'
import FabWithAddMenuContext from '@/modules/drive/FabWithAddMenuContext'
import Toolbar from '@/modules/drive/Toolbar'
import Dropzone from '@/modules/upload/Dropzone'
import DropzoneDnD from '@/modules/upload/DropzoneDnD'
import { useTrashRedirect } from '@/modules/views/Drive/useTrashRedirect'
import FolderView from '@/modules/views/Folder/FolderView'
import FolderViewBody from '@/modules/views/Folder/FolderViewBody'
import FolderViewBreadcrumb from '@/modules/views/Folder/FolderViewBreadcrumb'
import FolderViewHeader from '@/modules/views/Folder/FolderViewHeader'
import { useFabOnMobile } from '@/modules/views/Folder/hooks/useFabOnMobile'
import { useFolderViewBase } from '@/modules/views/Folder/hooks/useFolderViewBase'
import { filterOutReceivedShares } from '@/modules/views/Folder/syncHelpers'
import FolderViewBodyVz from '@/modules/views/Folder/virtualized/FolderViewBody'
import { useResumeUploadFromFlagship } from '@/modules/views/Upload/useResumeFromFlagship'

const DriveFolderView = () => {
  const base = useFolderViewBase()
  const { t } = base
  const params = useParams()
  const currentFolderId = useCurrentFolderId()
  useHead()
  const { isBigThumbnail, toggleThumbnailSize } = useThumbnailSizeContext()
  const sharingContext = useSharingContext()
  const { allLoaded, hasWriteAccess, refresh, isOwner, byDocId } =
    sharingContext
  const nativeSharing = useNativeFileSharing()
  const { hasClipboardData } = useClipboardContext()

  const { displayedFolder, isNotFound } = useDisplayedFolder()

  useTrashRedirect(displayedFolder)

  const [sortOrder, setSortOrder, isSettingsLoaded] =
    useFolderSort(currentFolderId)

  const {
    allResults: rawResults,
    isInError,
    isLoading,
    isPending
  } = useDriveQueries(currentFolderId, sortOrder)
  // Received shares are tagged with an io.cozy.sharings reference by the stack
  // and may be materialised among the recipient's own files; they belong in the
  // Sharings section, not My Drive. Wait until the sharing context is fully
  // loaded so isOwner can tell a received share from the user's own folders;
  // filtering earlier sees an incomplete picture and would show-then-hide them.
  const allResults = useMemo(
    () =>
      allLoaded ? filterOutReceivedShares(rawResults, isOwner) : rawResults,
    [allLoaded, rawResults, isOwner]
  )
  const [foldersResult, filesResult] = allResults
  const canWriteToCurrentFolder = hasWriteAccess(currentFolderId)

  useKeyboardShortcuts({
    canPaste: hasClipboardData && canWriteToCurrentFolder,
    client: base.client,
    items: [...(foldersResult.data || []), ...(filesResult.data || [])],
    sharingContext,
    pushModal: base.pushModal,
    popModal: base.popModal,
    refresh
  })

  const actionsOptions = {
    ...base,
    ...nativeSharing,
    refresh,
    hasWriteAccess: canWriteToCurrentFolder,
    canMove: true,
    isPublic: false,
    allLoaded,
    isOwner,
    byDocId,
    selectAll: () =>
      base.toggleSelectAllItems(allResults.flatMap(query => query.data || [])),
    displayedFolder
  }
  const actions = makeActions(
    [
      selectAllItems,
      share,
      shareNative,
      download,
      hr,
      summariseByAI,
      signWithEuDss,
      verifyWithEuDss,
      hr,
      rename,
      moveTo,
      duplicateTo,
      addToFavorites,
      removeFromFavorites,
      personalizeFolder,
      infos,
      hr,
      versions,
      hr,
      trash
    ],
    actionsOptions
  )

  const rootBreadcrumbPath = useMemo(
    () => ({
      id: ROOT_DIR_ID,
      name: t('breadcrumb.title_drive')
    }),
    [t]
  )

  useResumeUploadFromFlagship()

  const isFabDisplayed = useFabOnMobile(canWriteToCurrentFolder)

  const DropzoneComp =
    flag('drive.virtualization.enabled') && !base.isMobile
      ? DropzoneDnD
      : Dropzone

  return (
    <FolderView isNotFound={isNotFound}>
      <DropzoneComp
        disabled={!canWriteToCurrentFolder}
        displayedFolder={displayedFolder}
      >
        <FolderViewHeader>
          {currentFolderId && (
            <FolderViewBreadcrumb
              rootBreadcrumbPath={rootBreadcrumbPath}
              currentFolderId={currentFolderId}
            />
          )}
          <Toolbar
            canUpload={true}
            canCreateFolder={true}
            disabled={isLoading || isInError || isPending}
            isBigThumbnail={isBigThumbnail}
            toggleThumbnailSize={toggleThumbnailSize}
          />
        </FolderViewHeader>
        {flag('drive.show.harvest-banner') && (
          <HarvestBanner folderId={currentFolderId} />
        )}
        {flag('drive.virtualization.enabled') && !base.isMobile ? (
          <FolderViewBodyVz
            actions={actions}
            queryResults={allResults}
            currentFolderId={currentFolderId}
            displayedFolder={displayedFolder}
            canDrag
            canUpload={canWriteToCurrentFolder}
            orderProps={{
              sortOrder,
              setOrder: setSortOrder,
              isSettingsLoaded
            }}
          />
        ) : (
          <FolderViewBody
            actions={actions}
            queryResults={allResults}
            canSort
            currentFolderId={currentFolderId}
            displayedFolder={displayedFolder}
            canUpload={canWriteToCurrentFolder}
            orderProps={{
              sortOrder,
              setOrder: setSortOrder,
              isSettingsLoaded
            }}
          />
        )}
        {isFabDisplayed && (
          <AddMenuProvider
            componentsProps={{
              AddMenu: {
                anchorOrigin: {
                  vertical: 'top',
                  horizontal: 'left'
                }
              }
            }}
            canCreateFolder={true}
            canUpload={true}
            disabled={isLoading || isInError || isPending}
            navigate={base.navigate}
            params={params}
            displayedFolder={displayedFolder}
            isSelectionBarVisible={base.isSelectionBarVisible}
          >
            <FabWithAddMenuContext />
          </AddMenuProvider>
        )}
        <Outlet />
      </DropzoneComp>
    </FolderView>
  )
}

export { DriveFolderView }
