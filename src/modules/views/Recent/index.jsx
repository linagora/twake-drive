import React from 'react'
import { useDispatch } from 'react-redux'
import { useNavigate, Outlet, useLocation } from 'react-router-dom'
import { useI18n } from 'twake-i18n'

import { useClient } from 'cozy-client'
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

import FolderView from '../Folder/FolderView'
import FolderViewBody from '../Folder/FolderViewBody'
import FolderViewHeader from '../Folder/FolderViewHeader'
import FolderViewBodyVz from '../Folder/virtualized/FolderViewBody'

import useHead from '@/components/useHead'
import { RECENT_FOLDER_ID } from '@/constants/config'
import { useFolderSort } from '@/hooks'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import useRecentFiles from '@/hooks/useRecentFiles'
import { useModalContext } from '@/lib/ModalContext'
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
import { makeExtraColumnsNamesFromMedia } from '@/modules/certifications'
import { useExtraColumns } from '@/modules/certifications/useExtraColumns'
import AddMenuProvider from '@/modules/drive/AddMenu/AddMenuProvider'
import FabWithAddMenuContext from '@/modules/drive/FabWithAddMenuContext'
import Toolbar from '@/modules/drive/Toolbar'
import { useSelectionContext } from '@/modules/selection/SelectionProvider'
import { buildRecentWithMetadataAttributeQuery } from '@/queries'

const desktopExtraColumnsNames = ['carbonCopy', 'electronicSafe']
const mobileExtraColumnsNames = []

export const RecentView = () => {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { t, lang } = useI18n()
  const { isMobile } = useBreakpoints()
  const client = useClient()
  const { pushModal, popModal } = useModalContext()
  const { isSelectionBarVisible, toggleSelectAllItems, isSelectAll } =
    useSelectionContext()
  const sharingContext = useSharingContext()
  const { allLoaded, refresh, isOwner, byDocId } = sharingContext
  const { isNativeFileSharingAvailable, shareFilesNative } =
    useNativeFileSharing()
  const dispatch = useDispatch()
  useHead()
  const { showAlert } = useAlert()
  const [sortOrder, setSortOrder, isSettingsLoaded] =
    useFolderSort(RECENT_FOLDER_ID)

  const extraColumnsNames = makeExtraColumnsNamesFromMedia({
    isMobile,
    desktopExtraColumnsNames,
    mobileExtraColumnsNames
  })

  const extraColumns = useExtraColumns({
    columnsNames: extraColumnsNames,
    queryBuilder: buildRecentWithMetadataAttributeQuery
  })

  const recentsResult = useRecentFiles()

  useKeyboardShortcuts({
    client,
    items: recentsResult?.data || [],
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
    isOwner,
    byDocId,
    isMobile,
    isNativeFileSharingAvailable,
    shareFilesNative,
    selectAll: () => toggleSelectAllItems(recentsResult?.data || []),
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
      hr,
      trash
    ],
    actionsOptions
  )

  return (
    <FolderView>
      <Content className={isMobile ? '' : 'u-pt-1'}>
        <FolderViewHeader>
          <Breadcrumb path={[{ name: t('breadcrumb.title_recent') }]} />
          <Toolbar canUpload={false} canCreateFolder={false} />
        </FolderViewHeader>
        {flag('drive.virtualization.enabled') && !isMobile ? (
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
            extraColumns={extraColumns}
          />
        )}
        <Outlet />
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

export default RecentView
