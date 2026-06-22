import React from 'react'
import { Outlet } from 'react-router-dom'

import flag from 'cozy-flags'
import {
  useSharingContext,
  useNativeFileSharing,
  shareNative
} from 'cozy-sharing'
import { makeActions } from 'cozy-ui/transpiled/react/ActionsMenu/Actions'
import { Content } from 'cozy-ui/transpiled/react/Layout'
import LinearProgress from 'cozy-ui/transpiled/react/LinearProgress'

import FolderView from '../Folder/FolderView'
import FolderViewBody from '../Folder/FolderViewBody'
import FolderViewHeader from '../Folder/FolderViewHeader'
import FolderViewBodyVz from '../Folder/virtualized/FolderViewBody'

import useHead from '@/components/useHead'
import { RECENT_FOLDER_ID } from '@/constants/config'
import { useFolderSort } from '@/hooks'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import useRecentFiles from '@/hooks/useRecentFiles'
import {
  download,
  trash,
  rename,
  infos,
  versions,
  hr,
  share,
  selectAllItems,
  summariseByAI
} from '@/modules/actions'
import { addToFavorites } from '@/modules/actions/components/addToFavorites'
import { moveTo } from '@/modules/actions/components/moveTo'
import { removeFromFavorites } from '@/modules/actions/components/removeFromFavorites'
import { MobileAwareBreadcrumb as Breadcrumb } from '@/modules/breadcrumb/components/MobileAwareBreadcrumb'
import AddMenuProvider from '@/modules/drive/AddMenu/AddMenuProvider'
import FabWithAddMenuContext from '@/modules/drive/FabWithAddMenuContext'
import Toolbar from '@/modules/drive/Toolbar'
import { useFolderViewBase } from '@/modules/views/Folder/hooks/useFolderViewBase'

export const RecentView = () => {
  const base = useFolderViewBase()
  const sharingContext = useSharingContext()
  const { allLoaded, refresh, isOwner, byDocId } = sharingContext
  const nativeSharing = useNativeFileSharing()
  useHead({ title: base.t('breadcrumb.title_recent') })
  const [sortOrder, setSortOrder, isSettingsLoaded] =
    useFolderSort(RECENT_FOLDER_ID)

  const recentsResult = useRecentFiles()

  // Shared-drive and federated files arrive from the dataproxy seconds after
  // the local files; surface that background fetch once a list is on screen.
  const isFetchingMore =
    recentsResult?.fetchStatus === 'loading' && recentsResult?.data?.length > 0

  useKeyboardShortcuts({
    client: base.client,
    items: recentsResult?.data || [],
    sharingContext,
    allowCopy: false,
    pushModal: base.pushModal,
    popModal: base.popModal,
    refresh
  })

  const actionsOptions = {
    ...base,
    ...nativeSharing,
    refresh,
    hasWriteAccess: true,
    canMove: true,
    isPublic: false,
    allLoaded,
    isOwner,
    byDocId,
    selectAll: () => base.toggleSelectAllItems(recentsResult?.data || [])
  }

  const actions = makeActions(
    [
      selectAllItems,
      share,
      shareNative,
      download,
      hr,
      summariseByAI,
      hr,
      rename,
      moveTo,
      addToFavorites,
      removeFromFavorites,
      infos,
      hr,
      versions,
      hr,
      trash
    ],
    actionsOptions
  )

  return (
    <FolderView>
      <Content className={base.isMobile ? '' : 'u-pt-1'}>
        <FolderViewHeader>
          <Breadcrumb path={[{ name: base.t('breadcrumb.title_recent') }]} />
          <Toolbar canUpload={false} canCreateFolder={false} />
        </FolderViewHeader>
        {isFetchingMore && <LinearProgress />}
        {flag('drive.virtualization.enabled') && !base.isMobile ? (
          <FolderViewBodyVz
            actions={actions}
            queryResults={[recentsResult]}
            withFilePath={true}
            orderProps={{
              sortOrder,
              setOrder: setSortOrder,
              isSettingsLoaded
            }}
          />
        ) : (
          <FolderViewBody
            actions={actions}
            queryResults={[recentsResult]}
            withFilePath={true}
          />
        )}
        <Outlet />
        {base.isMobile && (
          <AddMenuProvider
            canCreateFolder={true}
            canUpload={true}
            disabled={false}
            displayedFolder={null}
            isSelectionBarVisible={base.isSelectionBarVisible}
            isPublic={false}
            refreshFolderContent={() => {}}
          >
            <FabWithAddMenuContext noSidebar={false} />
          </AddMenuProvider>
        )}
      </Content>
    </FolderView>
  )
}

export default RecentView
