import React from 'react'

import { useClient } from 'cozy-client'
import { createCozySharingLink, useSharingInfos } from 'cozy-sharing'
import { makeActions } from 'cozy-ui/transpiled/react/ActionsMenu/Actions'
import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'
import { useI18n } from 'twake-i18n'

import { BarRightOnMobile } from '@/components/Bar'
import { useDisplayedFolder } from '@/hooks'
import { addItems, download, hr, select } from '@/modules/actions'
import AddMenuProvider from '@/modules/drive/AddMenu/AddMenuProvider'
import AddButton from '@/modules/drive/Toolbar/components/AddButton'
import ViewSwitcher from '@/modules/drive/Toolbar/components/ViewSwitcher'
import PublicToolbarMoreMenu from '@/modules/public/PublicToolbarMoreMenu'
import { useSelectionContext } from '@/modules/selection/SelectionProvider'
import UploadButton from '@/modules/upload/UploadButton'

const PublicToolbarByLink = ({
  files,
  hasWriteAccess,
  refreshFolderContent
}) => {
  const { isMobile } = useBreakpoints()
  const { displayedFolder } = useDisplayedFolder()
  const { showSelectionBar, isSelectionBarVisible } = useSelectionContext()
  const { t } = useI18n()
  const { showAlert } = useAlert()
  const client = useClient()
  const { createCozyLink } = useSharingInfos()

  const isMoreMenuDisplayed = files.length > 1

  const actions = makeActions(
    [
      download,
      files.length > 1 && select,
      addItems,
      isMobile && (files.length > 1 || hasWriteAccess) && hr,
      isMobile && createCozySharingLink
    ],
    {
      t,
      showAlert,
      client,
      showSelectionBar,
      createCozyLink,
      hasWriteAccess
    }
  )

  return (
    <BarRightOnMobile>
      <AddMenuProvider
        canCreateFolder={hasWriteAccess}
        canUpload={hasWriteAccess}
        refreshFolderContent={refreshFolderContent}
        isPublic={true}
        displayedFolder={displayedFolder}
        isSelectionBarVisible={isSelectionBarVisible}
        componentsProps={{ AddMenu: { isUploadDisabled: true } }}
      >
        {!isMobile && (
          <>
            {hasWriteAccess && (
              <>
                <AddButton className="u-mr-half" isPublic />
                <UploadButton
                  className="u-mr-half"
                  label={t('upload.label')}
                  displayedFolder={displayedFolder}
                  onUploaded={refreshFolderContent}
                />
              </>
            )}
            <ViewSwitcher className="u-ml-half" />
          </>
        )}
        {isMoreMenuDisplayed && (
          <PublicToolbarMoreMenu
            files={files}
            hasWriteAccess={hasWriteAccess}
            showSelectionBar={showSelectionBar}
            actions={actions}
          />
        )}
      </AddMenuProvider>
    </BarRightOnMobile>
  )
}

export default PublicToolbarByLink
