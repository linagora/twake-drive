import React from 'react'
import { useSearchParams } from 'react-router-dom'

import { SharingBannerPlugin, OpenSharingLinkFabButton } from 'cozy-sharing'
import { useSharingInfos } from 'cozy-sharing'
import { DialogTitle } from 'cozy-ui/transpiled/react/Dialog'
import Divider from 'cozy-ui/transpiled/react/Divider'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'
import { makeStyles } from 'cozy-ui/transpiled/react/styles'

import { TrashedBanner } from '@/components/TrashedBanner'
import { useOnlyOfficeContext } from '@/modules/views/OnlyOffice/OnlyOfficeProvider'
import Toolbar from '@/modules/views/OnlyOffice/Toolbar'

const useStyles = makeStyles(theme => ({
  root: {
    width: '100%',
    height: '3rem',
    backgroundColor: theme.palette.background.paper
  }
}))

const Title = () => {
  const [searchParams] = useSearchParams(window.location.search)
  const { isMobile } = useBreakpoints()
  const { fileId, isPublic, isTrashed } = useOnlyOfficeContext()
  const sharingInfos = useSharingInfos()
  const { loading, isSharingShortcutCreated } = sharingInfos
  const styles = useStyles()

  // Check if the sharing shortcut has already been created (but not synced)
  const isShareAlreadyAdded = !loading && isSharingShortcutCreated
  // Check if you are sharing Cozy to Cozy (Link sharing is on the `/public` route)
  const isCozyToCozySharing = window.location.pathname === '/preview'
  // Check if you are sharing Cozy to Cozy synced (Also on the `/public` route)
  const isCozyToCozySharingSynced = searchParams.has('username')
  // Show the sharing banner plugin only on shared links view and cozy to cozy sharing view(not added)
  const isSharingBannerPluginDisplayed =
    isPublic &&
    (!isShareAlreadyAdded || !isCozyToCozySharing) &&
    !isCozyToCozySharingSynced

  const isAddToMyCozyFabDisplayed =
    isMobile && isCozyToCozySharing && !isShareAlreadyAdded

  return (
    <div style={{ zIndex: 'var(--zIndex-nav)' }}>
      <DialogTitle
        data-testid="onlyoffice-title"
        disableTypography
        className="u-ellipsis u-flex u-flex-items-center u-p-0 u-pr-1"
        classes={styles}
      >
        <Toolbar sharingInfos={sharingInfos} />
      </DialogTitle>
      <Divider />
      {isTrashed ? (
        <div style={{ backgroundColor: 'var(--paperBackgroundColor)' }}>
          <TrashedBanner fileId={fileId} isPublic={isPublic} />
        </div>
      ) : isSharingBannerPluginDisplayed ? (
        <SharingBannerPlugin />
      ) : null}
      {isAddToMyCozyFabDisplayed && (
        <OpenSharingLinkFabButton link={sharingInfos.addSharingLink} />
      )}
    </div>
  )
}

export default React.memo(Title)
