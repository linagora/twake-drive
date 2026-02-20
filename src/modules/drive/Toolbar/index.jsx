import cx from 'classnames'
import PropTypes from 'prop-types'
import React from 'react'

import { SharedDocument, useSharingContext } from 'cozy-sharing'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'

import styles from '@/styles/toolbar.styl'

import { BarRightOnMobile } from '@/components/Bar'
import { useDisplayedFolder, useCurrentFolderId } from '@/hooks'
import InsideRegularFolder from '@/modules/drive/Toolbar/components/InsideRegularFolder'
import MoreMenu from '@/modules/drive/Toolbar/components/MoreMenu'
import SearchButton from '@/modules/drive/Toolbar/components/SearchButton'
import ViewSwitcher from '@/modules/drive/Toolbar/components/ViewSwitcher'
import ShareButton from '@/modules/drive/Toolbar/share/ShareButton'
import SharedRecipients from '@/modules/drive/Toolbar/share/SharedRecipients'
import { useSelectionContext } from '@/modules/selection/SelectionProvider'
import {
  isFolderFromSharedDriveRecipient,
  isFolderFromSharedDriveOwner
} from '@/modules/shareddrives/helpers'

const Toolbar = ({
  folderId,
  disabled,
  canUpload,
  canCreateFolder,
  hasWriteAccess,
  isSharedWithMe,
  showShareButton = true
}) => {
  const { displayedFolder } = useDisplayedFolder()
  const { isMobile } = useBreakpoints()
  const { showSelectionBar, isSelectionBarVisible } = useSelectionContext()
  const { allLoaded } = useSharingContext() // We need to wait for the sharing context to be completely loaded to avoid race conditions

  const isDisabled = disabled || isSelectionBarVisible
  const isSharingDisabled = isDisabled || !allLoaded
  const isSharedDriveRecipient =
    isFolderFromSharedDriveRecipient(displayedFolder)
  const isSharedDriveOwner = isFolderFromSharedDriveOwner(displayedFolder)

  const moreMenuProps = {
    isDisabled,
    hasWriteAccess,
    isSharedWithMe,
    canCreateFolder,
    canUpload,
    folderId,
    displayedFolder,
    showSelectionBar,
    isSelectionBarVisible,
    isSharedDriveRecipient,
    isSharedDriveOwner
  }

  if (disabled) {
    return null
  }

  return (
    <div
      data-testid="fil-toolbar-files"
      className={cx(styles['fil-toolbar-files'], 'u-flex-items-center')}
      role="toolbar"
    >
      <InsideRegularFolder
        displayedFolder={displayedFolder}
        folderId={folderId}
      >
        <SharedRecipients />
      </InsideRegularFolder>
      <InsideRegularFolder
        displayedFolder={displayedFolder}
        folderId={folderId}
      >
        {hasWriteAccess && showShareButton && (
          <ShareButton
            isDisabled={isSharingDisabled}
            useShortLabel={isSharedDriveRecipient}
            className="u-mr-half"
          />
        )}
      </InsideRegularFolder>
      <ViewSwitcher className="u-mr-half" />
      <BarRightOnMobile>
        {isMobile && <SearchButton />}
        <MoreMenu {...moreMenuProps} />
      </BarRightOnMobile>
    </div>
  )
}

Toolbar.propTypes = {
  folderId: PropTypes.string,
  disabled: PropTypes.bool,
  canUpload: PropTypes.bool,
  canCreateFolder: PropTypes.bool,
  hasWriteAccess: PropTypes.bool
}

Toolbar.defaultProps = {
  canUpload: false,
  canCreateFolder: false,
  hasWriteAccess: false
}

/**
 * Provides the Toolbar with sharing properties of the current folder.
 *
 * In views where the displayed folder is virtual (eg: Recent files, Sharings),
 * no sharing information is provided to the Toolbar.
 */
const ToolbarWithSharingContext = props => {
  const folderId = useCurrentFolderId()
  const { driveId } = props

  return !folderId ? (
    <Toolbar {...props} />
  ) : (
    <SharedDocument docId={folderId} driveId={driveId}>
      {sharingProps => {
        const { hasWriteAccess, isSharedWithMe } = sharingProps
        return (
          <Toolbar
            hasWriteAccess={hasWriteAccess}
            isSharedWithMe={isSharedWithMe}
            folderId={folderId}
            {...props}
          />
        )
      }}
    </SharedDocument>
  )
}

ToolbarWithSharingContext.displayName = 'ToolbarWithSharingContext'

export default ToolbarWithSharingContext
