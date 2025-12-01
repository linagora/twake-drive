import React from 'react'
import { useSearchParams } from 'react-router-dom'

import { useQuery } from 'cozy-client'
import {
  addToCozySharingLink,
  createCozySharingLink,
  syncToCozySharingLink,
  OpenSharingLinkButton
} from 'cozy-sharing'
import { makeActions } from 'cozy-ui/transpiled/react/ActionsMenu/Actions'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'
import { useI18n } from 'cozy-ui/transpiled/react/providers/I18n'

import FilesRealTimeQueries from '@/components/FilesRealTimeQueries'
import { useRedirectLink } from '@/hooks/useRedirectLink'
import PublicToolbarMoreMenu from '@/modules/public/PublicToolbarMoreMenu'
import { useOnlyOfficeContext } from '@/modules/views/OnlyOffice/OnlyOfficeProvider'
import BackButton from '@/modules/views/OnlyOffice/Toolbar/BackButton'
import EditButton from '@/modules/views/OnlyOffice/Toolbar/EditButton'
import FileIcon from '@/modules/views/OnlyOffice/Toolbar/FileIcon'
import FileName from '@/modules/views/OnlyOffice/Toolbar/FileName'
import HomeIcon from '@/modules/views/OnlyOffice/Toolbar/HomeIcon'
import HomeLinker from '@/modules/views/OnlyOffice/Toolbar/HomeLinker'
import Separator from '@/modules/views/OnlyOffice/Toolbar/Separator'
import Sharing from '@/modules/views/OnlyOffice/Toolbar/Sharing'
import { isOfficeEditingEnabled } from '@/modules/views/OnlyOffice/helpers'
import { buildFileOrFolderByIdQuery, buildFileWhereByIdQuery } from '@/queries'

const Toolbar = ({ sharingInfos }) => {
  const { isMobile, isDesktop } = useBreakpoints()
  const [searchParams] = useSearchParams(window.location.search)
  const { isEditorReady, isReadOnly, isTrashed, fileId, isPublic } =
    useOnlyOfficeContext()
  const { t } = useI18n()
  const { redirectBack, canRedirect } = useRedirectLink({ isPublic })

  const fileQuery = isPublic
    ? buildFileOrFolderByIdQuery(fileId) // do not return path but return correctly data in public context
    : buildFileWhereByIdQuery(fileId) // return path but get a 403 in public context

  const { data } = useQuery(fileQuery.definition, fileQuery.options)
  const file = Array.isArray(data) ? data[0] : data

  if (!file) return null

  const {
    addSharingLink,
    syncSharingLink,
    createCozyLink,
    isSharingShortcutCreated,
    loading
  } = sharingInfos

  const showBackButton = canRedirect

  const handleOnClick = () => {
    redirectBack()
  }

  // Check if the share shortcut has not yet been added
  const isShareNotAdded = !loading && !isSharingShortcutCreated
  // Check if you are sharing Cozy to Cozy (Link sharing is on the `/public` route)
  const isCozyToCozySharing = window.location.pathname === '/preview'
  // Check if you are sharing Cozy to Cozy synced (Also on the `/public` route)
  const isCozyToCozySharingSynced = searchParams.has('username')

  // addSharingLink exists only in cozy to cozy sharing
  const link = isCozyToCozySharing ? addSharingLink : createCozyLink
  const actions = makeActions(
    [
      !isCozyToCozySharing && createCozySharingLink,
      isCozyToCozySharing && addToCozySharingLink,
      isCozyToCozySharing && syncToCozySharingLink
    ],
    {
      t,
      addSharingLink,
      syncSharingLink,
      createCozyLink,
      isSharingShortcutCreated
    }
  )
  const canEdit =
    isEditorReady &&
    !isReadOnly &&
    !isTrashed &&
    isOfficeEditingEnabled(isDesktop)

  const showPublicEditButton = isPublic && !isMobile && canEdit

  const showSharingLinkButton =
    isPublic && !isMobile && isShareNotAdded && !isCozyToCozySharingSynced

  return (
    <>
      <FilesRealTimeQueries />
      <div className="u-flex u-flex-items-center u-flex-grow-1 u-ellipsis">
        {!isMobile && (
          <>
            {isPublic ? (
              <HomeIcon />
            ) : (
              <HomeLinker>
                <HomeIcon />
              </HomeLinker>
            )}
            <Separator />
          </>
        )}
        {showBackButton && <BackButton onClick={handleOnClick} />}
        {!isMobile && file.class && <FileIcon fileClass={file.class} />}
        <FileName file={file} isPublic={isPublic} />
      </div>
      {showSharingLinkButton && (
        <OpenSharingLinkButton
          link={link}
          isSharingShortcutCreated={isSharingShortcutCreated}
          variant={showPublicEditButton ? 'secondary' : 'primary'}
        />
      )}
      {showPublicEditButton && <EditButton />}

      {isPublic && !isCozyToCozySharingSynced && (
        <PublicToolbarMoreMenu files={[file]} actions={actions} />
      )}

      {!isPublic && isEditorReady && (
        <>
          <Sharing file={file} />
          {canEdit && <EditButton />}
        </>
      )}
    </>
  )
}

export default React.memo(Toolbar)
