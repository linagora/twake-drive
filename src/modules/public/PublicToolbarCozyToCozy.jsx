import PropTypes from 'prop-types'
import React from 'react'

import { useClient } from 'cozy-client'
import { useVaultClient } from 'cozy-keys-lib'
import {
  addToCozySharingLink,
  syncToCozySharingLink,
  OpenSharingLinkButton
} from 'cozy-sharing'
import { makeActions } from 'cozy-ui/transpiled/react/ActionsMenu/Actions'
import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'
import { useI18n } from 'cozy-ui/transpiled/react/providers/I18n'

import { BarRightOnMobile } from '@/components/Bar'
import useCurrentFolderId from '@/hooks/useCurrentFolderId'
import { download, hr, select } from '@/modules/actions'
import ViewSwitcher from '@/modules/drive/Toolbar/components/ViewSwitcher'
import { DownloadFilesButton } from '@/modules/public/DownloadFilesButton'
import PublicToolbarMoreMenu from '@/modules/public/PublicToolbarMoreMenu'
import { useSelectionContext } from '@/modules/selection/SelectionProvider'

const PublicToolbarCozyToCozy = ({ sharingInfos, files }) => {
  const {
    loading,
    addSharingLink,
    syncSharingLink,
    sharing,
    isSharingShortcutCreated
  } = sharingInfos
  const { isMobile } = useBreakpoints()
  const { t } = useI18n()
  const { showAlert } = useAlert()
  const client = useClient()
  const { showSelectionBar } = useSelectionContext()
  const vaultClient = useVaultClient()
  const currentFolderId = useCurrentFolderId()
  // Sharing can be a folder or a file
  const itemId = currentFolderId ?? files[0]?._id

  const isOnSharedFolder =
    !loading && sharing?.rules?.some(rule => rule.values.includes(itemId))

  const actions = makeActions(
    [
      isMobile && download,
      files.length > 1 && select,
      ((isMobile && files.length > 0) || files.length > 1) && hr,
      isOnSharedFolder && addToCozySharingLink,
      isOnSharedFolder && syncToCozySharingLink
    ],
    {
      t,
      showAlert,
      client,
      vaultClient,
      showSelectionBar,
      isSharingShortcutCreated,
      addSharingLink,
      syncSharingLink
    }
  )

  return (
    <BarRightOnMobile>
      {!isMobile && (
        <>
          {files.length > 0 && <DownloadFilesButton files={files} />}
          {!isSharingShortcutCreated && isOnSharedFolder && (
            <OpenSharingLinkButton
              className="u-ml-half"
              link={addSharingLink}
              isSharingShortcutCreated={isSharingShortcutCreated}
            />
          )}
          <ViewSwitcher className="u-ml-half" />
        </>
      )}
      <PublicToolbarMoreMenu
        files={files}
        showSelectionBar={showSelectionBar}
        actions={actions}
      />
    </BarRightOnMobile>
  )
}

PublicToolbarCozyToCozy.propTypes = {
  files: PropTypes.array.isRequired,
  sharingInfos: PropTypes.object.isRequired
}

export default PublicToolbarCozyToCozy
