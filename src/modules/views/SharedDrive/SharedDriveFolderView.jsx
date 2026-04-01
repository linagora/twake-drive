import React, { useMemo, useContext, useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { Outlet, useParams, useNavigate, useLocation } from 'react-router-dom'

import { useClient } from 'cozy-client'
import flag from 'cozy-flags'
import { useVaultClient } from 'cozy-keys-lib'
import { useSharingContext } from 'cozy-sharing'
import { makeActions } from 'cozy-ui/transpiled/react/ActionsMenu/Actions'
import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'
import { useI18n } from 'twake-i18n'

import useHead from '@/components/useHead'
import { SHARED_DRIVES_DIR_ID } from '@/constants/config'
import { useClipboardContext } from '@/contexts/ClipboardProvider'
import { useDisplayedFolder, useFolderSort } from '@/hooks'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { FabContext } from '@/lib/FabProvider'
import { useModalContext } from '@/lib/ModalContext'
import {
  download,
  infos,
  versions,
  rename,
  trash,
  hr,
  share
} from '@/modules/actions'
import { duplicateTo } from '@/modules/actions/components/duplicateTo'
import { moveTo } from '@/modules/actions/components/moveTo'
import { personalizeFolder } from '@/modules/actions/components/personalizeFolder'
import AddMenuProvider from '@/modules/drive/AddMenu/AddMenuProvider'
import FabWithAddMenuContext from '@/modules/drive/FabWithAddMenuContext'
import Toolbar from '@/modules/drive/Toolbar'
import { useSelectionContext } from '@/modules/selection/SelectionProvider'
import { SharedDriveBreadcrumb } from '@/modules/shareddrives/components/SharedDriveBreadcrumb'
import { SharedDriveFolderBody } from '@/modules/shareddrives/components/SharedDriveFolderBody'
import { useSharedDriveFolder } from '@/modules/shareddrives/hooks/useSharedDriveFolder'
import Dropzone from '@/modules/upload/Dropzone'
import DropzoneDnD from '@/modules/upload/DropzoneDnD'
import FolderView from '@/modules/views/Folder/FolderView'
import FolderViewHeader from '@/modules/views/Folder/FolderViewHeader'
import FolderViewBodyVz from '@/modules/views/Folder/virtualized/FolderViewBody'

const SharedDriveFolderView = () => {
  const client = useClient()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { isMobile } = useBreakpoints()
  const params = useParams()
  useHead()
  const { driveId, folderId } = params
  const sharingContext = useSharingContext()
  const { isOwner, byDocId, hasWriteAccess, refresh, allLoaded } =
    sharingContext
  const { displayedFolder } = useDisplayedFolder()
  const { pushModal, popModal } = useModalContext()
  const { t } = useI18n()
  const { showAlert } = useAlert()
  const dispatch = useDispatch()
  const vaultClient = useVaultClient()
  const isInRootOfSharedDrive = displayedFolder?.dir_id === SHARED_DRIVES_DIR_ID
  const { isFabDisplayed, setIsFabDisplayed } = useContext(FabContext)
  const { isSelectionBarVisible } = useSelectionContext()

  const { sharedDriveResult, hasMore, fetchMore } = useSharedDriveFolder({
    driveId,
    folderId
  })

  const queryResults = sharedDriveResult
    ? [
        {
          fetchStatus: 'loaded',
          data: sharedDriveResult.included,
          hasMore,
          fetchMore
        }
      ]
    : []

  const canWriteToCurrentFolder = hasWriteAccess(folderId, driveId)

  const { hasClipboardData } = useClipboardContext()

  useEffect(() => {
    setIsFabDisplayed(canWriteToCurrentFolder && isMobile)
    return () => {
      setIsFabDisplayed(false)
    }
  }, [setIsFabDisplayed, isMobile, canWriteToCurrentFolder])

  const [sortOrder, setSortOrder, isSettingsLoaded] = useFolderSort(folderId)

  useKeyboardShortcuts({
    canPaste: hasClipboardData && canWriteToCurrentFolder,
    client,
    items: sharedDriveResult?.included || [],
    sharingContext,
    allowCut: canWriteToCurrentFolder,
    allowCopy: false,
    allowDelete: canWriteToCurrentFolder,
    pushModal,
    popModal,
    refresh
  })
  const actionsOptions = useMemo(
    () => ({
      client,
      t,
      vaultClient,
      pathname,
      isOwner,
      isMobile,
      driveId,
      hasWriteAccess: canWriteToCurrentFolder,
      byDocId,
      dispatch,
      canMove: canWriteToCurrentFolder,
      canDuplicate: canWriteToCurrentFolder,
      navigate,
      showAlert,
      pushModal,
      popModal,
      refresh,
      allLoaded
    }),
    [
      client,
      t,
      vaultClient,
      pathname,
      isOwner,
      isMobile,
      driveId,
      canWriteToCurrentFolder,
      byDocId,
      dispatch,
      navigate,
      showAlert,
      pushModal,
      popModal,
      refresh,
      allLoaded
    ]
  )

  const actions = useMemo(
    () =>
      makeActions(
        [
          share,
          download,
          hr,
          rename,
          moveTo,
          duplicateTo,
          personalizeFolder,
          infos,
          hr,
          versions,
          hr,
          trash
        ],
        actionsOptions
      ),
    [actionsOptions]
  )

  const DropzoneComp =
    flag('drive.virtualization.enabled') && !isMobile ? DropzoneDnD : Dropzone

  return (
    <FolderView>
      <DropzoneComp
        disabled={!canWriteToCurrentFolder}
        displayedFolder={displayedFolder}
      >
        <FolderViewHeader>
          <SharedDriveBreadcrumb driveId={driveId} folderId={folderId} />
          <Toolbar
            canUpload={false}
            canCreateFolder={canWriteToCurrentFolder}
            driveId={driveId}
            showShareButton={isInRootOfSharedDrive}
          />
        </FolderViewHeader>

        {flag('drive.virtualization.enabled') && !isMobile ? (
          <FolderViewBodyVz
            actions={actions}
            queryResults={queryResults}
            currentFolderId={folderId}
            displayedFolder={displayedFolder}
            canDrag
            canUpload={canWriteToCurrentFolder}
            withFilePath={false}
            driveId={driveId}
            orderProps={{
              sortOrder,
              setOrder: setSortOrder,
              isSettingsLoaded
            }}
          />
        ) : (
          <SharedDriveFolderBody
            folderId={folderId}
            queryResults={queryResults}
          />
        )}
        <Outlet />
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
            disabled={false}
            refreshFolderContent={refresh}
            displayedFolder={displayedFolder}
            isSelectionBarVisible={isSelectionBarVisible}
          >
            <FabWithAddMenuContext />
          </AddMenuProvider>
        )}
      </DropzoneComp>
    </FolderView>
  )
}

export { SharedDriveFolderView }
