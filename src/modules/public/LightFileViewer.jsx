import cx from 'classnames'
import PropTypes from 'prop-types'
import React, { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { BarCenter } from 'cozy-bar'
import {
  SharingBannerPlugin,
  useSharingInfos,
  OpenSharingLinkButton
} from 'cozy-sharing'
import MidEllipsis from 'cozy-ui/transpiled/react/MidEllipsis'
import Typography from 'cozy-ui/transpiled/react/Typography'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'
import Viewer, {
  FooterActionButtons,
  ForwardOrDownloadButton
} from 'cozy-viewer'

import styles from '@/modules/viewer/barviewer.styl'

import { FilesViewerLoading } from '@/components/FilesViewerLoading'
import PublicToolbar from '@/modules/public/PublicToolbar'
import {
  isOfficeEnabled,
  makeOnlyOfficeFileRoute
} from '@/modules/views/OnlyOffice/helpers'

const LightFileViewer = ({ files, isPublic }) => {
  const sharingInfos = useSharingInfos()
  const { isDesktop, isMobile } = useBreakpoints()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { loading, isSharingShortcutCreated, addSharingLink } = sharingInfos

  const onlyOfficeOpener = useCallback(
    file => {
      const route = makeOnlyOfficeFileRoute(file.id, {
        fromPathname: pathname
      })
      navigate(route)
    },
    [navigate, pathname]
  )

  const isCozySharing = window.location.pathname === '/preview'
  const isShareNotAdded = !loading && !isSharingShortcutCreated
  const isSharingBannerPluginDisplayed = isShareNotAdded || !isCozySharing
  const isAddToMyCozyDisplayed = isShareNotAdded && isCozySharing

  if (loading) return <FilesViewerLoading />

  return (
    <div className={styles['viewer-wrapper-with-bar']}>
      {isMobile && (
        <BarCenter>
          <Typography variant="h4" noWrap className="u-ph-1 u-pt-half">
            <MidEllipsis text={files[0].name} />
          </Typography>
        </BarCenter>
      )}
      {isSharingBannerPluginDisplayed && <SharingBannerPlugin />}
      {isMobile && (
        <PublicToolbar
          className={cx({ 'u-mt-1 u-mr-1': !isMobile })}
          files={files}
          sharingInfos={sharingInfos}
        />
      )}
      <div className="u-pos-relative u-h-100">
        <Viewer
          files={files}
          isPublic={isPublic}
          currentIndex={0}
          disableModal
          componentsProps={{
            OnlyOfficeViewer: {
              isEnabled: isOfficeEnabled(isDesktop),
              opener: onlyOfficeOpener
            },
            toolbarProps: {
              showToolbar: isDesktop,
              showClose: false,
              hideSummarizeBtn: true
            }
          }}
        >
          <FooterActionButtons>
            {isAddToMyCozyDisplayed && (
              <OpenSharingLinkButton
                link={addSharingLink}
                isSharingShortcutCreated={isSharingShortcutCreated}
                isShortLabel
                fullWidth
                variant="secondary"
              />
            )}
            <ForwardOrDownloadButton
              {...(isAddToMyCozyDisplayed ? { variant: 'buttonIcon' } : {})}
            />
          </FooterActionButtons>
        </Viewer>
      </div>
    </div>
  )
}

LightFileViewer.propTypes = {
  files: PropTypes.array.isRequired,
  isPublic: PropTypes.bool
}

export default LightFileViewer
