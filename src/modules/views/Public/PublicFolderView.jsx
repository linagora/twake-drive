import React, { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'

import flag from 'cozy-flags'
import {
  useSharingContext,
  SharingBannerPlugin,
  useSharingInfos,
  OpenSharingLinkFabButton
} from 'cozy-sharing'
import { makeActions } from 'cozy-ui/transpiled/react/ActionsMenu/Actions'
import { Content } from 'cozy-ui/transpiled/react/Layout'

import { usePublicDisplayFlags } from './usePublicDisplayFlags'
import usePublicFilesQuery from './usePublicFilesQuery'
import { usePublicRefresh } from './usePublicRefresh'
import usePublicWritePermissions from './usePublicWritePermissions'
import FolderViewBody from '../Folder/FolderViewBody'
import FolderViewBreadcrumb from '../Folder/FolderViewBreadcrumb'
import FolderViewHeader from '../Folder/FolderViewHeader'
import OldFolderViewBreadcrumb from '../Folder/OldFolderViewBreadcrumb'
import { useFabOnMobile } from '../Folder/hooks/useFabOnMobile'
import { useFolderViewBase } from '../Folder/hooks/useFolderViewBase'
import FolderViewBodyVz from '../Folder/virtualized/FolderViewBody'

import useHead from '@/components/useHead'
import { ROOT_DIR_ID } from '@/constants/config'
import { useClipboardContext } from '@/contexts/ClipboardProvider'
import { useCurrentFolderId, useDisplayedFolder } from '@/hooks'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { ModalStack } from '@/lib/ModalContext'
import { ModalManager } from '@/lib/react-cozy-helpers'
import {
  download,
  trash,
  rename,
  versions,
  selectAllItems,
  hr,
  summariseByAI
} from '@/modules/actions'
import { duplicateTo } from '@/modules/actions/components/duplicateTo'
import { moveTo } from '@/modules/actions/components/moveTo'
import { personalizeFolder } from '@/modules/actions/components/personalizeFolder'
import { fetchFolder } from '@/modules/breadcrumb/utils/fetchFolder'
import AddMenuProvider from '@/modules/drive/AddMenu/AddMenuProvider'
import FabWithAddMenuContext from '@/modules/drive/FabWithAddMenuContext'
import Main from '@/modules/layout/Main'
import PublicToolbar from '@/modules/public/PublicToolbar'
import Dropzone from '@/modules/upload/Dropzone'
import DropzoneDnD from '@/modules/upload/DropzoneDnD'

const fetchParentFolder = async ({ client, folderId }) => {
  try {
    return await fetchFolder({ client, folderId })
  } catch (_err) {
    return null
  }
}

const getBreadcrumbPath = async ({
  client,
  displayedFolder,
  sharedDocumentId
}) => {
  if (!displayedFolder) return
  const returnPath = [{ id: displayedFolder?.id, name: displayedFolder?.name }]
  let folder = displayedFolder
  while (folder && folder.id !== sharedDocumentId) {
    folder = await fetchParentFolder({ client, folderId: folder?.dir_id })
    if (folder) {
      returnPath.unshift({ id: folder?.id, name: folder?.name })
    }
  }
  return returnPath
}

const PublicFolderView = ({ sharedDocumentId }) => {
  const base = useFolderViewBase()
  const { navigate, pathname } = base
  // `state` is on useLocation; useFolderViewBase only forwards pathname.
  const { state } = useLocation()
  const currentFolderId = useCurrentFolderId()
  const { displayedFolder } = useDisplayedFolder()
  const { hasWritePermissions } = usePublicWritePermissions()
  const { refresh, isOwner, byDocId } = useSharingContext()
  const sharingInfos = useSharingInfos()
  const isOnSharedFolder =
    !sharingInfos.loading &&
    sharingInfos.sharing?.rules?.some(rule =>
      rule.values.includes(currentFolderId)
    )
  useHead()
  const { hasClipboardData } = useClipboardContext()

  const filesResult = usePublicFilesQuery(currentFolderId)
  const files = filesResult.data

  // The public token can't rely on realtime notifications, so refresh manually.
  const { refreshFolderContent, refreshAfterChange } = usePublicRefresh({
    filesResult,
    sharingRefresh: refresh
  })

  useKeyboardShortcuts({
    onPaste: refreshAfterChange,
    canPaste: hasWritePermissions && hasClipboardData,
    client: base.client,
    items: filesResult.data,
    sharingContext: null,
    allowCopy: hasWritePermissions,
    allowCut: hasWritePermissions,
    allowDelete: hasWritePermissions,
    isPublic: true,
    pushModal: base.pushModal,
    popModal: base.popModal,
    refresh: refreshAfterChange
  })

  useEffect(() => {
    if (state?.refresh === true) {
      refreshFolderContent()
      // Clear the state to prevent repeated refreshes
      navigate(pathname, { replace: true, state: null })
    }
  }, [state, refreshFolderContent, navigate, pathname])

  const actionOptions = {
    ...base,
    refresh: refreshAfterChange,
    hasWriteAccess: hasWritePermissions,
    canMove: hasWritePermissions,
    canDuplicate: hasWritePermissions,
    isPublic: true,
    isOwner,
    byDocId,
    selectAll: () => base.toggleSelectAllItems(filesResult.data),
    displayedFolder,
    onClose: () => {
      refreshAfterChange()
    }
  }
  const actions = makeActions(
    [
      selectAllItems,
      download,
      hr,
      summariseByAI,
      hr,
      moveTo,
      duplicateTo,
      hr,
      rename,
      personalizeFolder,
      versions,
      hr,
      trash
    ],
    actionOptions
  )

  const rootBreadcrumbPath = {
    id: ROOT_DIR_ID,
    name: 'Public'
  }

  const isFabDisplayed = useFabOnMobile(hasWritePermissions)

  const {
    isOldBreadcrumb,
    isSharingBannerPluginDisplayed,
    isAddToMyCozyFabDisplayed
  } = usePublicDisplayFlags({
    sharingInfos,
    isOnSharedFolder,
    isMobile: base.isMobile
  })

  const DropzoneComp =
    flag('drive.virtualization.enabled') && !base.isMobile
      ? DropzoneDnD
      : Dropzone

  return (
    <Main isPublic={true}>
      <ModalStack />
      <ModalManager />
      {isSharingBannerPluginDisplayed && <SharingBannerPlugin />}
      <Content className={base.isMobile ? '' : 'u-ml-1 u-pt-1'}>
        <DropzoneComp
          disabled={!hasWritePermissions}
          displayedFolder={displayedFolder}
          refreshFolderContent={refreshFolderContent}
        >
          <FolderViewHeader>
            {currentFolderId && (
              <>
                {isOldBreadcrumb ? (
                  <OldFolderViewBreadcrumb
                    displayedFolder={displayedFolder}
                    sharedDocumentId={sharedDocumentId}
                    getBreadcrumbPath={getBreadcrumbPath}
                  />
                ) : (
                  <FolderViewBreadcrumb
                    rootBreadcrumbPath={rootBreadcrumbPath}
                    currentFolderId={currentFolderId}
                  />
                )}
                <PublicToolbar
                  files={files}
                  hasWriteAccess={hasWritePermissions}
                  refreshFolderContent={refreshFolderContent}
                  sharingInfos={sharingInfos}
                />
              </>
            )}
          </FolderViewHeader>
          {flag('drive.virtualization.enabled') && !base.isMobile ? (
            <FolderViewBodyVz
              actions={actions}
              queryResults={[filesResult]}
              currentFolderId={currentFolderId}
              displayedFolder={displayedFolder}
              canDrag
              canUpload={hasWritePermissions}
              refreshFolderContent={refreshFolderContent}
            />
          ) : (
            <FolderViewBody
              actions={actions}
              queryResults={[filesResult]}
              canSort={false}
              currentFolderId={currentFolderId}
              refreshFolderContent={refreshFolderContent}
              canUpload={hasWritePermissions}
              isPublic={true}
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
              canCreateFolder={hasWritePermissions}
              canUpload={hasWritePermissions}
              refreshFolderContent={refreshFolderContent}
              isPublic={true}
              displayedFolder={displayedFolder}
              isSelectionBarVisible={base.isSelectionBarVisible}
            >
              <FabWithAddMenuContext noSidebar={true} />
            </AddMenuProvider>
          )}
          {isAddToMyCozyFabDisplayed && (
            <OpenSharingLinkFabButton link={sharingInfos.addSharingLink} />
          )}
        </DropzoneComp>
        <Outlet />
      </Content>
    </Main>
  )
}

export { PublicFolderView }
