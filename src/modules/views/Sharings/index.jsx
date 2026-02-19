import React, { useMemo, useState } from 'react'
import { useDispatch } from 'react-redux'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { useI18n } from 'twake-i18n'

import { useClient, hasQueryBeenLoaded, useQuery } from 'cozy-client'
import flag from 'cozy-flags'
import {
  useSharingContext,
  useNativeFileSharing,
  shareNative
} from 'cozy-sharing'
import { makeActions } from 'cozy-ui/transpiled/react/ActionsMenu/Actions'
import { Content } from 'cozy-ui/transpiled/react/Layout'
import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'

import SharingTab from './SharingTab'
import withSharedDocumentIds from './withSharedDocumentIds'
import FolderView from '../Folder/FolderView'
import FolderViewBody from '../Folder/FolderViewBody'
import FolderViewHeader from '../Folder/FolderViewHeader'
import FolderViewBodyVz from '../Folder/virtualized/FolderViewBody'

import useHead from '@/components/useHead'
import {
  SHARED_DRIVES_DIR_ID,
  SHARING_TAB_ALL,
  SHARING_TAB_DRIVES
} from '@/constants/config'
import { useFolderSort } from '@/hooks'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useTransformFolderListHasSharedDriveShortcuts } from '@/hooks/useTransformFolderListHasSharedDriveShortcuts'
import { useModalContext } from '@/lib/ModalContext'
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
import { useSelectionContext } from '@/modules/selection/SelectionProvider'
import { deleteSharedDrive } from '@/modules/shareddrives/components/actions/deleteSharedDrive'
import { leaveSharedDrive } from '@/modules/shareddrives/components/actions/leaveSharedDrive'
import { manageAccess } from '@/modules/shareddrives/components/actions/manageAccess'
import {
  buildSharingsQuery,
  buildSharingsWithMetadataAttributeQuery
} from '@/queries'
const desktopExtraColumnsNames = ['carbonCopy', 'electronicSafe']
const mobileExtraColumnsNames = []

export const SharingsView = ({ sharedDocumentIds = [] }) => {
  const navigate = useNavigate()
  const { pathname, search } = useLocation()
  const searchParams = new URLSearchParams(search)
  const tabParam = Number(searchParams.get('tab')) || SHARING_TAB_ALL
  const { t, lang } = useI18n()
  const { isMobile } = useBreakpoints()
  const client = useClient()
  const { pushModal, popModal } = useModalContext()
  const { isSelectionBarVisible, toggleSelectAllItems, isSelectAll } =
    useSelectionContext()
  const sharingContext = useSharingContext()
  const { allLoaded, refresh } = sharingContext
  const { isNativeFileSharingAvailable, shareFilesNative } =
    useNativeFileSharing()
  const dispatch = useDispatch()
  useHead({ title: t('breadcrumb.title_sharings') })
  const { showAlert } = useAlert()
  const [sortOrder, setSortOrder, isSettingsLoaded] = useFolderSort('sharings')

  const [tab, setTab] = useState(tabParam)

  const isEnabledSharedDrive = flag('drive.shared-drive.enabled')
  const isEnabledFederatedSharedFolder = flag(
    'drive.federated-shared-folder.enabled'
  )

  const extraColumnsNames = makeExtraColumnsNamesFromMedia({
    isMobile,
    desktopExtraColumnsNames,
    mobileExtraColumnsNames
  })

  const extraColumns = useExtraColumns({
    columnsNames: extraColumnsNames,
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

  /**
   * Problem:
   * - In the recipient's Sharing section, shared drives appear only as shortcuts
   *   and don’t contain a root folder id (the folder id in the owner's shared drive).
   *
   * Why:
   * - To open a shared drive, we need a URL like `shareddrive/:driveId/:rootFolderId`.
   * - This information exists in `io.cozy.sharings`, which includes root folder id,
   *   but the structure is not compatible with the directory format expected
   *   in the Sharing UI.
   *
   * Solution:
   * - Transform `sharedDrives` into directory-like objects with the required
   *   properties (`id`, `path`, `attributes`,...) so they can be displayed
   *   and opened consistently.
   */
  const {
    sharedDrives: transformedSharedDrives,
    nonSharedDriveList,
    sharedDrivesLoaded
  } = useTransformFolderListHasSharedDriveShortcuts(result.data)

  const filteredResult = useMemo(() => {
    if (!isEnabledSharedDrive && !isEnabledFederatedSharedFolder) {
      const filteredResultData =
        result.data?.filter(item => !(item.dir_id === SHARED_DRIVES_DIR_ID)) ||
        []
      return {
        ...result,
        // If there are no shared documents, we consider the data is loaded by setting fetchStatus to 'loaded' and lastFetch to now.
        fetchStatus:
          sharedDocumentIds?.length > 0 ? result.fetchStatus : 'loaded',
        lastFetch:
          sharedDocumentIds?.length > 0 ? result.lastFetch : Date.now(),
        data: filteredResultData,
        count: filteredResultData.length
      }
    }
    const combinedData =
      tab === SHARING_TAB_DRIVES
        ? transformedSharedDrives
        : [...transformedSharedDrives, ...nonSharedDriveList]

    return {
      ...result,
      fetchStatus:
        sharedDocumentIds?.length > 0 ? result.fetchStatus : 'loaded',
      lastFetch: sharedDocumentIds?.length > 0 ? result.lastFetch : Date.now(),
      data: combinedData,
      count: combinedData.length
    }
  }, [
    isEnabledSharedDrive,
    isEnabledFederatedSharedFolder,
    tab,
    transformedSharedDrives,
    nonSharedDriveList,
    result,
    sharedDocumentIds?.length
  ])

  useKeyboardShortcuts({
    onPaste: () => refresh(),
    client,
    items: filteredResult?.data || [],
    sharingContext,
    allowCopy: false,
    pushModal,
    popModal,
    refresh
  })

  const actionsOptions = {
    client,
    t,
    lang,
    pushModal,
    popModal,
    refresh,
    dispatch,
    navigate,
    pathname,
    hasWriteAccess: true,
    canMove: true,
    isPublic: false,
    allLoaded,
    showAlert,
    isMobile,
    isNativeFileSharingAvailable,
    shareFilesNative,
    selectAll: () => toggleSelectAllItems(result.data),
    isSelectAll
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
      manageAccess,
      hr,
      deleteSharedDrive,
      leaveSharedDrive
    ],
    actionsOptions
  )

  return (
    <FolderView>
      <Content className={isMobile ? '' : 'u-pt-1'}>
        <FolderViewHeader>
          <Breadcrumb path={[{ name: t('breadcrumb.title_sharings') }]} />
          <Toolbar canUpload={false} canCreateFolder={false} />
        </FolderViewHeader>
        {isEnabledSharedDrive && <SharingTab tab={tab} setTab={setTab} />}
        {!allLoaded ||
        !sharedDrivesLoaded ||
        !hasQueryBeenLoaded(filteredResult) ? (
          <FileListRowsPlaceholder />
        ) : (
          <>
            {flag('drive.virtualization.enabled') && !isMobile ? (
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
        {isMobile && (
          <AddMenuProvider
            canCreateFolder={true}
            canUpload={true}
            disabled={false}
            displayedFolder={null}
            isSelectionBarVisible={isSelectionBarVisible}
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
