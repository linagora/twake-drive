import React, { useMemo, useContext, useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { Outlet, useParams, useNavigate, useLocation } from 'react-router-dom'

import { hasQueryBeenLoaded, useClient, useQuery } from 'cozy-client'
import flag from 'cozy-flags'
import { useSharingContext } from 'cozy-sharing'
import { makeActions } from 'cozy-ui/transpiled/react/ActionsMenu/Actions'
import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'
import { useI18n } from 'twake-i18n'

import Oops from '@/components/Error/Oops'
import useHead from '@/components/useHead'
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
import AddButton from '@/modules/drive/Toolbar/components/AddButton'
import FileListRowsPlaceholder from '@/modules/filelist/FileListRowsPlaceholder'
import { isSpacePath } from '@/modules/routeUtils'
import { useSelectionContext } from '@/modules/selection/SelectionProvider'
import { SharedDriveBreadcrumb } from '@/modules/shareddrives/components/SharedDriveBreadcrumb'
import { SharedDriveFolderBody } from '@/modules/shareddrives/components/SharedDriveFolderBody'
import { getFolderIdFromSharing } from '@/modules/shareddrives/helpers'
import { useSharedDriveFolder } from '@/modules/shareddrives/hooks/useSharedDriveFolder'
import Dropzone from '@/modules/upload/Dropzone'
import DropzoneDnD from '@/modules/upload/DropzoneDnD'
import { UploadButton } from '@/modules/upload/UploadButton'
import FolderView from '@/modules/views/Folder/FolderView'
import FolderViewHeader from '@/modules/views/Folder/FolderViewHeader'
import FolderViewBodyVz from '@/modules/views/Folder/virtualized/FolderViewBody'
import { useReportSpaceFiles } from '@/modules/views/Space/useReportSpaceFiles'
import { buildSharedDriveIdQuery } from '@/queries'

function SharedDriveFolderActions({
  driveId,
  folderId,
  canWrite,
  showShareButton
}) {
  const { pathname } = useLocation()
  const { isMobile } = useBreakpoints()
  const { t } = useI18n()
  const { isSelectionBarVisible } = useSelectionContext()
  const { displayedFolder } = useDisplayedFolder()
  const isInSpace = isSpacePath(pathname)

  return (
    <>
      {isInSpace && !isMobile && (
        <div className="u-flex u-flex-items-center u-ml-auto">
          <UploadButton
            className="u-mr-half"
            variant="secondary"
            disabled={!canWrite}
            folderId={folderId}
            driveId={driveId}
            displayedFolder={displayedFolder}
            label={t('upload.label')}
          />
          <AddMenuProvider
            canCreateFolder={true}
            canUpload={true}
            disabled={!canWrite}
            displayedFolder={displayedFolder}
            isSelectionBarVisible={isSelectionBarVisible}
            componentsProps={{ AddMenu: { isUploadDisabled: true } }}
          >
            <AddButton className="u-mr-half" />
          </AddMenuProvider>
        </div>
      )}
      <Toolbar
        canUpload={canWrite}
        canCreateFolder={canWrite}
        driveId={driveId}
        showShareButton={showShareButton}
        showSharedRecipients={!isInSpace}
        showMoreMenu={!isInSpace}
      />
    </>
  )
}

function SharedDriveFolderViewContent({ sharing, driveId, folderId }) {
  const client = useClient()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { isMobile } = useBreakpoints()
  const sharingContext = useSharingContext()
  const { isOwner, byDocId, hasWriteAccess, refresh, allLoaded } =
    sharingContext
  const { displayedFolder } = useDisplayedFolder()
  const { pushModal, popModal } = useModalContext()
  const { t } = useI18n()
  const { showAlert } = useAlert()
  const dispatch = useDispatch()
  const isInRootOfSharedDrive = getFolderIdFromSharing(sharing) === folderId
  const { isFabDisplayed, setIsFabDisplayed } = useContext(FabContext)
  const { isSelectionBarVisible } = useSelectionContext()

  const { sharedDriveResult, fetchStatus, lastUpdate, hasMore, fetchMore } =
    useSharedDriveFolder({
      driveId,
      folderId
    })

  useReportSpaceFiles({
    driveId,
    folder: sharedDriveResult.folder,
    isRoot: isInRootOfSharedDrive
  })

  const queryResults = [
    {
      fetchStatus,
      lastUpdate,
      data: sharedDriveResult.included ?? [],
      hasMore,
      fetchMore
    }
  ]

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
          <SharedDriveFolderActions
            driveId={driveId}
            folderId={folderId}
            canWrite={canWriteToCurrentFolder}
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

function SharedDriveFolderView() {
  const { driveId, folderId } = useParams()
  useHead()

  const sharingQuery = buildSharedDriveIdQuery({ driveId })
  const sharingResult = useQuery(sharingQuery.definition, sharingQuery.options)

  if (sharingResult.fetchStatus === 'failed') {
    return (
      <FolderView>
        <Oops />
      </FolderView>
    )
  }

  if (!hasQueryBeenLoaded(sharingResult)) {
    return (
      <FolderView>
        <FileListRowsPlaceholder />
      </FolderView>
    )
  }

  if (!sharingResult.data) {
    return <FolderView isNotFound />
  }

  return (
    <SharedDriveFolderViewContent
      sharing={sharingResult.data}
      driveId={driveId}
      folderId={folderId}
    />
  )
}

export { SharedDriveFolderView }
