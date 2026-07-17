import React, { useMemo } from 'react'
import { Outlet } from 'react-router-dom'

import { hasQueryBeenLoaded, useQuery } from 'cozy-client'
import flag from 'cozy-flags'
import {
  useSharingContext,
  useNativeFileSharing,
  shareNative
} from 'cozy-sharing'
import { makeActions } from 'cozy-ui/transpiled/react/ActionsMenu/Actions'
import { Content } from 'cozy-ui/transpiled/react/Layout'

import SharingsHeader from './SharingsHeader'
import { buildSharingsActionsOptions } from './helpers'
import { useFilteredSharings } from './useFilteredSharings'
import { areDrivesAvailable, useSharingsTab } from './useSharingsTab'
import withSharedDocumentIds from './withSharedDocumentIds'
import FolderView from '../Folder/FolderView'
import FolderViewBody from '../Folder/FolderViewBody'
import { useFolderViewBase } from '../Folder/hooks/useFolderViewBase'
import FolderViewBodyVz from '../Folder/virtualized/FolderViewBody'

import useHead from '@/components/useHead'
import { SHARING_TAB_DRIVES } from '@/constants/config'
import { useFolderSort } from '@/hooks'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import {
  download,
  rename,
  infos,
  versions,
  share,
  hr,
  selectAllItems,
  summariseByAI
} from '@/modules/actions'
import { addToFavorites } from '@/modules/actions/components/addToFavorites'
import { moveTo } from '@/modules/actions/components/moveTo'
import { removeFromFavorites } from '@/modules/actions/components/removeFromFavorites'
import AddMenuProvider from '@/modules/drive/AddMenu/AddMenuProvider'
import FabWithAddMenuContext from '@/modules/drive/FabWithAddMenuContext'
import FileListRowsPlaceholder from '@/modules/filelist/FileListRowsPlaceholder'
import { leaveSharedDrive } from '@/modules/shareddrives/components/actions/leaveSharedDrive'
import { shareFileRootSharedDrive } from '@/modules/shareddrives/components/actions/shareFileRootSharedDrive'
import { shareSharedDrive } from '@/modules/shareddrives/components/actions/shareSharedDrive'
import { buildSharingsQuery } from '@/queries'

export const SharingsView = ({ sharedDocumentIds = [] }) => {
  const base = useFolderViewBase()
  const sharingContext = useSharingContext()
  const { allLoaded, refresh } = sharingContext
  const nativeSharing = useNativeFileSharing()
  useHead({ title: base.t('breadcrumb.title_sharings') })
  const [sortOrder, setSortOrder, isSettingsLoaded] = useFolderSort('sharings')
  const [tab, setTab] = useSharingsTab()

  const query = useMemo(
    () =>
      buildSharingsQuery({
        ids: sharedDocumentIds,
        enabled: allLoaded && sharedDocumentIds?.length > 0
      }),
    [sharedDocumentIds, allLoaded]
  )
  const result = useQuery(query.definition, query.options)

  const { filteredResult, sharedDrivesLoaded, hasDrives } = useFilteredSharings(
    {
      result,
      sharedDocumentIds,
      tab
    }
  )

  // The Team drives tab only shows while it has content; it stays rendered
  // when it is the active tab so a ?tab=drives deep link keeps a visible,
  // consistent control (the list then shows the empty state).
  const showDrives =
    areDrivesAvailable() && (hasDrives || tab === SHARING_TAB_DRIVES)

  useKeyboardShortcuts({
    onPaste: () => refresh(),
    client: base.client,
    items: filteredResult?.data || [],
    sharingContext,
    allowCopy: false,
    pushModal: base.pushModal,
    popModal: base.popModal,
    refresh
  })

  const actionsOptions = buildSharingsActionsOptions({
    base,
    nativeSharing,
    sharingContext,
    filteredResult
  })

  const actions = makeActions(
    [
      selectAllItems,
      share,
      shareNative,
      shareSharedDrive,
      shareFileRootSharedDrive,
      download,
      hr,
      summariseByAI,
      hr,
      rename,
      moveTo,
      addToFavorites,
      removeFromFavorites,
      leaveSharedDrive,
      infos,
      hr,
      versions
    ],
    actionsOptions
  )

  return (
    <FolderView>
      <Content className={base.isMobile ? '' : 'u-pt-1'}>
        <SharingsHeader
          title={base.t('breadcrumb.title_sharings')}
          isMobile={base.isMobile}
          tab={tab}
          onChange={setTab}
          showDrives={showDrives}
        />
        {!allLoaded ||
        !sharedDrivesLoaded ||
        !hasQueryBeenLoaded(filteredResult) ? (
          <FileListRowsPlaceholder />
        ) : (
          <>
            {flag('drive.virtualization.enabled') && !base.isMobile ? (
              <FolderViewBodyVz
                actions={actions}
                queryResults={[filteredResult]}
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
                queryResults={[filteredResult]}
                canSort={true}
                withFilePath={true}
                orderProps={{
                  sortOrder,
                  setOrder: setSortOrder,
                  isSettingsLoaded
                }}
              />
            )}
            <Outlet />
          </>
        )}
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

export default withSharedDocumentIds(SharingsView)
