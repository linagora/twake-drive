import React from 'react'
import { useNavigate, Navigate, Outlet, useLocation } from 'react-router-dom'

import { useQuery, useClient } from 'cozy-client'
import flag from 'cozy-flags'
import { useSharingContext } from 'cozy-sharing'
import { makeActions } from 'cozy-ui/transpiled/react/ActionsMenu/Actions'
import { Content } from 'cozy-ui/transpiled/react/Layout'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'
import { useI18n } from 'twake-i18n'

import FolderView from '../Folder/FolderView'
import FolderViewBody from '../Folder/FolderViewBody'
import FolderViewHeader from '../Folder/FolderViewHeader'
import FolderViewBodyVz from '../Folder/virtualized/FolderViewBody'

import useHead from '@/components/useHead'
import { SORT_BY_UPDATE_DATE } from '@/config/sort'
import { useCurrentFolderId, useDisplayedFolder, useFolderSort } from '@/hooks'
import { restore, selectAllItems } from '@/modules/actions'
import AddMenuProvider from '@/modules/drive/AddMenu/AddMenuProvider'
import FabWithAddMenuContext from '@/modules/drive/FabWithAddMenuContext'
import { useSelectionContext } from '@/modules/selection/SelectionProvider'
import { TrashBreadcrumb } from '@/modules/trash/components/TrashBreadcrumb'
import { TrashToolbar } from '@/modules/trash/components/TrashToolbar'
import { destroy } from '@/modules/trash/components/actions/destroy'
import { isInTrashDir } from '@/modules/trash/helpers'
import { buildTrashQuery } from '@/queries'

export const TrashFolderView = () => {
  const { isMobile } = useBreakpoints()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { isSelectionBarVisible, toggleSelectAllItems, isSelectAll } =
    useSelectionContext()
  const currentFolderId = useCurrentFolderId()
  const { t } = useI18n()
  const { refresh } = useSharingContext()
  const client = useClient()
  useHead()

  const { displayedFolder, isNotFound } = useDisplayedFolder()
  const isTrashFolder = isInTrashDir(displayedFolder?.path)

  const [sortOrder, setSortOrder, isSettingsLoaded] =
    useFolderSort(currentFolderId)

  // Sort by size does not work for directory, so in case sorting by size we will change to default sorting
  const folderQuery = buildTrashQuery({
    currentFolderId,
    type: 'directory',
    sortAttribute:
      sortOrder.attribute !== 'size'
        ? sortOrder.attribute
        : SORT_BY_UPDATE_DATE.attribute,
    sortOrder:
      sortOrder.attribute !== 'size'
        ? sortOrder.order
        : SORT_BY_UPDATE_DATE.order
  })
  const fileQuery = buildTrashQuery({
    currentFolderId,
    type: 'file',
    sortAttribute: sortOrder.attribute,
    sortOrder: sortOrder.order,
    limit: 50
  })

  const foldersResult = useQuery(folderQuery.definition, folderQuery.options)
  const filesResult = useQuery(fileQuery.definition, fileQuery.options)

  // A loading folder may be live, and live files must never be destroyed
  const trashActions = isTrashFolder ? [selectAllItems, restore, destroy] : []
  const actions = makeActions(trashActions, {
    client,
    t,
    refresh,
    navigate,
    pathname,
    selectAll: () =>
      toggleSelectAllItems(
        [foldersResult, filesResult].map(query => query.data).flat()
      ),
    isSelectAll
  })

  // Trash actions would permanently delete the content of a live folder
  if (displayedFolder?.path && !isTrashFolder) {
    return <Navigate to={`/folder/${displayedFolder.id}`} replace />
  }

  return (
    <FolderView isNotFound={isNotFound}>
      <Content className={isMobile ? '' : 'u-pt-1'}>
        <FolderViewHeader>
          <TrashBreadcrumb currentFolderId={currentFolderId} />
          <TrashToolbar />
        </FolderViewHeader>
        {flag('drive.virtualization.enabled') && !isMobile ? (
          <FolderViewBodyVz
            actions={actions}
            queryResults={[foldersResult, filesResult]}
            currentFolderId={currentFolderId}
            withFilePath={false}
            canUpload={false}
            orderProps={{
              sortOrder,
              setOrder: setSortOrder,
              isSettingsLoaded
            }}
          />
        ) : (
          <FolderViewBody
            currentFolderId={currentFolderId}
            displayedFolder={displayedFolder}
            actions={actions}
            queryResults={[foldersResult, filesResult]}
            withFilePath={false}
            canSort
            canUpload={false}
            orderProps={{
              sortOrder,
              setOrder: setSortOrder,
              isSettingsLoaded
            }}
          />
        )}
        <Outlet />
        {isMobile && (
          <AddMenuProvider
            canCreateFolder={true}
            canUpload={true}
            disabled={false}
            displayedFolder={displayedFolder}
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

export default TrashFolderView
