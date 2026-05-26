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

import { useFilteredSharings } from './useFilteredSharings'
import withSharedDocumentIds from './withSharedDocumentIds'
import FolderView from '../Folder/FolderView'
import FolderViewBody from '../Folder/FolderViewBody'
import FolderViewHeader from '../Folder/FolderViewHeader'
import { useFolderViewBase } from '../Folder/hooks/useFolderViewBase'
import FolderViewBodyVz from '../Folder/virtualized/FolderViewBody'

import useHead from '@/components/useHead'
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
import { MobileAwareBreadcrumb as Breadcrumb } from '@/modules/breadcrumb/components/MobileAwareBreadcrumb'
import { makeExtraColumnsNamesFromMedia } from '@/modules/certifications'
import { useExtraColumns } from '@/modules/certifications/useExtraColumns'
import AddMenuProvider from '@/modules/drive/AddMenu/AddMenuProvider'
import FabWithAddMenuContext from '@/modules/drive/FabWithAddMenuContext'
import Toolbar from '@/modules/drive/Toolbar'
import FileListRowsPlaceholder from '@/modules/filelist/FileListRowsPlaceholder'
import { leaveSharedDrive } from '@/modules/shareddrives/components/actions/leaveSharedDrive'
import { shareSharedDrive } from '@/modules/shareddrives/components/actions/shareSharedDrive'
import {
  buildSharingsQuery,
  buildSharingsWithMetadataAttributeQuery
} from '@/queries'

const desktopExtraColumnsNames = ['carbonCopy', 'electronicSafe']
const mobileExtraColumnsNames = []

export const SharingsView = ({ sharedDocumentIds = [] }) => {
  const base = useFolderViewBase()
  const sharingContext = useSharingContext()
  const { allLoaded, refresh } = sharingContext
  const nativeSharing = useNativeFileSharing()
  useHead({ title: base.t('breadcrumb.title_sharings') })
  const [sortOrder, setSortOrder, isSettingsLoaded] = useFolderSort('sharings')

  const extraColumns = useExtraColumns({
    columnsNames: makeExtraColumnsNamesFromMedia({
      isMobile: base.isMobile,
      desktopExtraColumnsNames,
      mobileExtraColumnsNames
    }),
    queryBuilder: buildSharingsWithMetadataAttributeQuery,
    sharedDocumentIds
  })

  const query = useMemo(
    () =>
      buildSharingsQuery({
        ids: sharedDocumentIds,
        enabled: allLoaded && sharedDocumentIds?.length > 0
      }),
    [sharedDocumentIds, allLoaded]
  )
  const result = useQuery(query.definition, query.options)

  const { filteredResult, sharedDrivesLoaded } = useFilteredSharings({
    result,
    sharedDocumentIds
  })

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

  const actionsOptions = {
    ...base,
    ...nativeSharing,
    refresh,
    hasWriteAccess: true,
    canMove: true,
    isPublic: false,
    shouldHideIfSharedDriveRecipient: true,
    allLoaded,
    // Select All has to match the rendered list, not the raw query: the
    // rendered list excludes the magic shared-drives dir when the feature
    // flags are off and substitutes transformed shortcut entries when on.
    selectAll: () => base.toggleSelectAllItems(filteredResult.data)
  }

  const actions = makeActions(
    [
      selectAllItems,
      share,
      shareNative,
      shareSharedDrive,
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
        <FolderViewHeader>
          <Breadcrumb path={[{ name: base.t('breadcrumb.title_sharings') }]} />
          <Toolbar canUpload={false} canCreateFolder={false} />
        </FolderViewHeader>
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
                extraColumns={extraColumns}
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
