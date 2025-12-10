import React, { FC } from 'react'
import { useDispatch } from 'react-redux'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useI18n } from 'twake-i18n'

import { useClient, useQuery } from 'cozy-client'
import { IOCozyFile } from 'cozy-client/types/types'
import {
  useSharingContext,
  useNativeFileSharing,
  shareNative
} from 'cozy-sharing'
import { makeActions } from 'cozy-ui/transpiled/react/ActionsMenu/Actions'
import { Content } from 'cozy-ui/transpiled/react/Layout'
import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'

import { useFolderSort } from '@/hooks'
import { useModalContext } from '@/lib/ModalContext'
import {
  download,
  rename,
  infos,
  versions,
  share,
  hr,
  trash,
  summariseByAI
} from '@/modules/actions'
import { addToFavorites } from '@/modules/actions/components/addToFavorites'
import { moveTo } from '@/modules/actions/components/moveTo'
import { removeFromFavorites } from '@/modules/actions/components/removeFromFavorites'
import { MobileAwareBreadcrumb as Breadcrumb } from '@/modules/breadcrumb/components/MobileAwareBreadcrumb'
import { makeExtraColumnsNamesFromMedia } from '@/modules/certifications'
import {
  useExtraColumns,
  ExtraColumn
} from '@/modules/certifications/useExtraColumns'
import AddMenuProvider from '@/modules/drive/AddMenu/AddMenuProvider'
import FabWithAddMenuContext from '@/modules/drive/FabWithAddMenuContext'
import Toolbar from '@/modules/drive/Toolbar'
import { FolderBody } from '@/modules/folder/components/FolderBody'
import { isNextcloudShortcut } from '@/modules/nextcloud/helpers'
import { useSelectionContext } from '@/modules/selection/SelectionProvider'
import FolderView from '@/modules/views/Folder/FolderView'
import FolderViewHeader from '@/modules/views/Folder/FolderViewHeader'
import {
  buildFavoritesQuery,
  buildFileWithSpecificMetadataAttributeQuery
} from '@/queries'

const desktopExtraColumnsNames = ['carbonCopy', 'electronicSafe']
const mobileExtraColumnsNames: string[] = []

const FavoritesView: FC = () => {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { isMobile } = useBreakpoints()
  const { t, lang } = useI18n()
  const client = useClient()
  const { isSelectionBarVisible } = useSelectionContext()
  const { pushModal, popModal } = useModalContext()
  const { allLoaded, refresh } = useSharingContext()
  const { isNativeFileSharingAvailable, shareFilesNative } =
    useNativeFileSharing()
  const dispatch = useDispatch()
  const { showAlert } = useAlert()
  const [sortOrder] = useFolderSort('favorites')

  const extraColumnsNames = makeExtraColumnsNamesFromMedia({
    isMobile,
    desktopExtraColumnsNames,
    mobileExtraColumnsNames
  })

  const extraColumns = useExtraColumns({
    columnsNames: extraColumnsNames,
    queryBuilder: buildFileWithSpecificMetadataAttributeQuery,
    currentFolderId: 'io.cozy.files.shared-drives-dir'
  }) as ExtraColumn[]

  const favoritesQuery = buildFavoritesQuery({
    sortAttribute: sortOrder.attribute,
    sortOrder: sortOrder.order
  })
  const favoritesResult = useQuery(
    favoritesQuery.definition,
    favoritesQuery.options
  ) as {
    data?: IOCozyFile[] | null
  }

  const handleInteractWith = (file: IOCozyFile): boolean =>
    !isNextcloudShortcut(file)

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
    shareFilesNative
  }

  const actions = makeActions(
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    [
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
    <FolderView isNotFound={false}>
      <Content className={isMobile ? '' : 'u-pt-1'}>
        <FolderViewHeader>
          <Breadcrumb path={[{ name: t('breadcrumb.title_favorites') }]} />
          <Toolbar canUpload={false} canCreateFolder={false} />
        </FolderViewHeader>
        <FolderBody
          folderId="io.cozy.files.shared-drives-dir"
          queryResults={[favoritesResult]}
          extraColumns={extraColumns}
          actions={actions}
          canSort={true}
          canInteractWith={handleInteractWith}
        />
        <Outlet />
        {isMobile && (
          <AddMenuProvider
            canCreateFolder={true}
            canUpload={true}
            disabled={false}
            displayedFolder={null}
            isSelectionBarVisible={isSelectionBarVisible}
            isPublic={false}
            isReadOnly={false}
            refreshFolderContent={(): void => {
              // Empty function needed because this props is required
            }}
          >
            <FabWithAddMenuContext noSidebar={false} />
          </AddMenuProvider>
        )}
      </Content>
    </FolderView>
  )
}

export { FavoritesView }
