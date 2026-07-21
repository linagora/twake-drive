import React, { useContext, useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { useParams, useNavigate, useLocation } from 'react-router-dom'

import { useClient } from 'cozy-client'
import { useVaultClient } from 'cozy-keys-lib'
import { useSharingContext } from 'cozy-sharing'
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
import { useSelectionContext } from '@/modules/selection/SelectionProvider'
import { useRedirectOnRevokedDrive } from '@/modules/shareddrives/hooks/useRedirectOnRevokedDrive'
import { useSharedDriveFolder } from '@/modules/shareddrives/hooks/useSharedDriveFolder'
import { useSharedDriveFolderActions } from '@/modules/shareddrives/hooks/useSharedDriveFolderActions'
import FolderView from '@/modules/views/Folder/FolderView'
import { SharedDriveFolderContent } from '@/modules/views/SharedDrive/SharedDriveFolderContent'

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

  useRedirectOnRevokedDrive(driveId)

  const { sharedDriveResult, fetchStatus, lastUpdate, hasMore, fetchMore } =
    useSharedDriveFolder({
      driveId,
      folderId
    })

  const queryResults = [
    {
      fetchStatus,
      lastUpdate,
      data: sharedDriveResult.data ?? [],
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
    items: sharedDriveResult?.data || [],
    sharingContext,
    allowCut: canWriteToCurrentFolder,
    allowCopy: false,
    allowDelete: canWriteToCurrentFolder,
    pushModal,
    popModal,
    refresh
  })

  const actions = useSharedDriveFolderActions({
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
  })

  return (
    <FolderView>
      <SharedDriveFolderContent
        actions={actions}
        queryResults={queryResults}
        folderId={folderId}
        displayedFolder={displayedFolder}
        canWriteToCurrentFolder={canWriteToCurrentFolder}
        driveId={driveId}
        isInRootOfSharedDrive={isInRootOfSharedDrive}
        sortOrder={sortOrder}
        setSortOrder={setSortOrder}
        isSettingsLoaded={isSettingsLoaded}
        isFabDisplayed={isFabDisplayed}
        refresh={refresh}
        isSelectionBarVisible={isSelectionBarVisible}
        isMobile={isMobile}
      />
    </FolderView>
  )
}

export { SharedDriveFolderView }
