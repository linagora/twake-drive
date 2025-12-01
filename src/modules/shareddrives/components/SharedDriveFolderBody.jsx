import React from 'react'
import { useDispatch } from 'react-redux'
import { useNavigate, useLocation, useParams } from 'react-router-dom'

import { useClient } from 'cozy-client'
import { useVaultClient } from 'cozy-keys-lib'
import { useSharingContext } from 'cozy-sharing'
import { makeActions } from 'cozy-ui/transpiled/react/ActionsMenu/Actions'
import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'
import { useI18n } from 'cozy-ui/transpiled/react/providers/I18n'

import { useModalContext } from '@/lib/ModalContext'
import { download, infos, versions, rename, trash, hr } from '@/modules/actions'
import { moveTo } from '@/modules/actions/components/moveTo'
import { personalizeFolder } from '@/modules/actions/components/personalizeFolder'
import { FolderBody } from '@/modules/folder/components/FolderBody'

const SharedDriveFolderBody = ({
  folderId,
  queryResults,
  refreshFolderContent
}) => {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const client = useClient()
  const vaultClient = useVaultClient()
  const { driveId } = useParams()
  const { t } = useI18n()
  const { isOwner, byDocId, hasWriteAccess, refresh } = useSharingContext()
  const { isMobile } = useBreakpoints()
  const { showAlert } = useAlert()
  const dispatch = useDispatch()
  const { pushModal, popModal } = useModalContext()

  const canWriteToCurrentFolder = hasWriteAccess(folderId, driveId)

  const actionsOptions = {
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
    canMove: true,
    navigate,
    showAlert,
    pushModal,
    popModal,
    refresh
  }
  const actions = makeActions(
    [
      download,
      hr,
      rename,
      moveTo,
      personalizeFolder,
      infos,
      hr,
      versions,
      hr,
      trash
    ],
    actionsOptions
  )

  return (
    <FolderBody
      folderId={folderId}
      queryResults={queryResults}
      actions={actions}
      withFilePath={false}
      driveId={driveId}
      refreshFolderContent={refreshFolderContent}
    />
  )
}

export { SharedDriveFolderBody }
