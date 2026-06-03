import PropTypes from 'prop-types'
import React, { useCallback } from 'react'

import { DialogTitle } from 'cozy-ui/transpiled/react/Dialog'
import Divider from 'cozy-ui/transpiled/react/Divider'
import Icon from 'cozy-ui/transpiled/react/Icon'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'
import { makeStyles } from 'cozy-ui/transpiled/react/styles'

import ExcalidrawIcon from '@/assets/icons/icon-excalidraw.svg'
import BackButton from '@/components/EditorToolbar/BackButton'
import FileName from '@/components/EditorToolbar/FileName'
import HomeIcon from '@/components/EditorToolbar/HomeIcon'
import HomeLinker from '@/components/EditorToolbar/HomeLinker'
import Separator from '@/components/EditorToolbar/Separator'
import Sharing from '@/components/EditorToolbar/Sharing'
import { useRedirectLink } from '@/hooks/useRedirectLink'

const useStyles = makeStyles(theme => ({
  root: {
    width: '100%',
    height: '3rem',
    backgroundColor: theme.palette.background.paper
  }
}))

const Title = ({ file, flushRef, isPublic = false, isReadOnly = false }) => {
  const { isMobile } = useBreakpoints()
  const { redirectBack, canRedirect } = useRedirectLink({ isPublic })
  const styles = useStyles()

  // Force a save of any pending change before leaving the editor.
  const handleBack = useCallback(async () => {
    await flushRef?.current?.()
    redirectBack()
  }, [flushRef, redirectBack])

  return (
    <div style={{ zIndex: 'var(--zIndex-nav)' }}>
      <DialogTitle
        data-testid="excalidraw-title"
        disableTypography
        className="u-ellipsis u-flex u-flex-items-center u-p-0 u-pr-1"
        classes={styles}
      >
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
          {canRedirect && <BackButton onClick={handleBack} />}
          {!isMobile && (
            <Icon className="u-ml-half" icon={ExcalidrawIcon} size={32} />
          )}
          <FileName file={file} isPublic={isPublic} isReadOnly={isReadOnly} />
        </div>
        {!isPublic && <Sharing file={file} />}
      </DialogTitle>
      <Divider />
    </div>
  )
}

Title.propTypes = {
  file: PropTypes.object.isRequired,
  flushRef: PropTypes.object,
  isPublic: PropTypes.bool,
  isReadOnly: PropTypes.bool
}

export default React.memo(Title)
