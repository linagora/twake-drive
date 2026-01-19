import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from 'twake-i18n'

import { useClient } from 'cozy-client'
import { fetchBlobFileById, isFile } from 'cozy-client/dist/models/file'
import { useWebviewIntent } from 'cozy-intent'
import { useVaultClient } from 'cozy-keys-lib'
import {
  useSharingContext,
  useNativeFileSharing,
  shareNative,
  addToCozySharingLink,
  syncToCozySharingLink,
  useSharingInfos
} from 'cozy-sharing'
import {
  makeActions,
  print
} from 'cozy-ui/transpiled/react/ActionsMenu/Actions'
import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'
import { useBreakpoints } from 'cozy-ui/transpiled/react/providers/Breakpoints'

import { useCurrentFolderId } from '@/hooks'
import { useModalContext } from '@/lib/ModalContext'
import { share, download, trash, versions, hr } from '@/modules/actions'
import { addToFavorites } from '@/modules/actions/components/addToFavorites'
import { duplicateTo } from '@/modules/actions/components/duplicateTo'
import { moveTo } from '@/modules/actions/components/moveTo'
import { removeFromFavorites } from '@/modules/actions/components/removeFromFavorites'
import { filterActionsByPolicy } from '@/modules/actions/policies'

export const useMoreMenuActions = file => {
  const [isPrintAvailable, setIsPrintAvailable] = useState(false)
  const client = useClient()
  const vaultClient = useVaultClient()
  const webviewIntent = useWebviewIntent()
  const { t, lang } = useI18n()
  const { isMobile } = useBreakpoints()
  const navigate = useNavigate()
  const { pushModal, popModal } = useModalContext()
  const { allLoaded, hasWriteAccess, isOwner, byDocId } = useSharingContext()
  const { showAlert } = useAlert()
  const { isNativeFileSharingAvailable, shareFilesNative } =
    useNativeFileSharing()
  const currentFolderId = useCurrentFolderId()
  const { isSharingShortcutCreated, addSharingLink, syncSharingLink } =
    useSharingInfos()
  const canWriteToCurrentFolder = hasWriteAccess(currentFolderId, file.driveId)
  const isPDFDoc = file.mime === 'application/pdf'
  const showPrintAction = isPDFDoc && isPrintAvailable
  const isCozySharing = window.location.pathname === '/preview'
  const isSharedDrive = window.location.href.includes('/shareddrive/')

  const actions = makeActions(
    [
      share,
      shareNative,
      isCozySharing && addToCozySharingLink,
      isCozySharing && syncToCozySharingLink,
      download,
      showPrintAction && print,
      hr,
      moveTo,
      !isSharedDrive && duplicateTo, // TO DO: Remove condition when duplicating is available in shared drive
      addToFavorites,
      removeFromFavorites,
      hr,
      versions,
      hr,
      trash
    ],
    {
      client,
      t,
      lang,
      vaultClient,
      pushModal,
      popModal,
      refresh: () => navigate('..'),
      navigate,
      hasWriteAccess: canWriteToCurrentFolder,
      canMove: canWriteToCurrentFolder,
      isPublic: false,
      allLoaded,
      showAlert,
      isOwner,
      byDocId,
      isNativeFileSharingAvailable,
      shareFilesNative,
      isSharingShortcutCreated,
      openSharingLinkDisplayed: isCozySharing,
      syncSharingLink,
      isMobile,
      fetchBlobFileById,
      isFile,
      addSharingLink,
      driveId: file.driveId
    }
  )

  const filteredActions = filterActionsByPolicy(actions, [file])

  useEffect(() => {
    const init = async () => {
      const isAvailable =
        (await webviewIntent?.call('isAvailable', 'print')) ?? true

      setIsPrintAvailable(isAvailable)
    }

    init()
  }, [webviewIntent])

  return filteredActions
}
