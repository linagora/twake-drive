import React, { useCallback } from 'react'
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
import { usePersonalRecents } from '@/hooks/usePersonalRecents'
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
import { FileLastUpdatedProvider } from '@/modules/filelist/FileLastUpdatedContext'
import { FileParentFolderProvider } from '@/modules/filelist/FileParentFolderContext'
import { makeParentFolderName } from '@/modules/filelist/helpers'
import { useSharedDrives } from '@/modules/shareddrives/hooks/useSharedDrives'
import { useFolderViewBase } from '@/modules/views/Folder/hooks/useFolderViewBase'

// The shortcuts act on the selection, so they stay unmounted while the view
// offers no item action.
const KeyboardShortcuts = props => {
  useKeyboardShortcuts(props)
  return null
}

const RecentViewContent = ({
  recentsResult,
  orderProps,
  keepQueryOrder = false,
  withActions = true
}) => {
  const base = useFolderViewBase()
  const sharingContext = useSharingContext()
  const { allLoaded, refresh, isOwner, byDocId } = sharingContext
  const nativeSharing = useNativeFileSharing()
  useHead({ title: base.t('breadcrumb.title_recent') })

  // Shared-drive and federated files arrive from the dataproxy seconds after
  // the local files; surface that background fetch once a list is on screen.
  const isFetchingMore =
    recentsResult?.fetchStatus === 'loading' && recentsResult?.data?.length > 0

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
    withDriveIdInModalPath: true,
    selectAll: () => base.toggleSelectAllItems(recentsResult?.data || [])
  }

  const recentActions = makeActions(
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
  const actions = withActions ? recentActions : []

  return (
    <FolderView>
      {withActions && (
        <KeyboardShortcuts
          client={base.client}
          items={recentsResult?.data || []}
          sharingContext={sharingContext}
          allowCopy={false}
          pushModal={base.pushModal}
          popModal={base.popModal}
          refresh={refresh}
        />
      )}
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
            orderProps={{ ...orderProps, keepQueryOrder }}
          />
        ) : (
          <FolderViewBody
            actions={actions}
            queryResults={[recentsResult]}
            withFilePath={true}
            orderProps={{ keepQueryOrder }}
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

const DataProxyRecentView = () => {
  const [sortOrder, setSortOrder, isSettingsLoaded] =
    useFolderSort(RECENT_FOLDER_ID)
  const recentsResult = useRecentFiles()

  return (
    <RecentViewContent
      recentsResult={recentsResult}
      orderProps={{ sortOrder, setOrder: setSortOrder, isSettingsLoaded }}
    />
  )
}

// Item actions come back with linagora/twake-drive#4591.
const PersonalRecentView = () => {
  const recentsResult = usePersonalRecents()
  const { sharedDrives } = useSharedDrives()

  const getParentFolderPath = useCallback(
    file =>
      makeParentFolderName(
        file,
        driveId =>
          sharedDrives.find(drive => drive._id === driveId)?.description ?? null
      ),
    [sharedDrives]
  )

  return (
    <FileLastUpdatedProvider
      getFileLastUpdatedAt={recentsResult.getLastActivityAt}
      groupDirectoriesFirstByUpdatedAt={false}
      showDirectoryLastUpdated={true}
    >
      <FileParentFolderProvider getParentFolderPath={getParentFolderPath}>
        <RecentViewContent
          recentsResult={recentsResult}
          keepQueryOrder={true}
          withActions={false}
        />
      </FileParentFolderProvider>
    </FileLastUpdatedProvider>
  )
}

export const RecentView = () =>
  flag('drive.recents.enabled') ? (
    <PersonalRecentView />
  ) : (
    <DataProxyRecentView />
  )

export default RecentView
