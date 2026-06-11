import PropTypes from 'prop-types'
import React, { useCallback } from 'react'

import { DialogTitle } from 'cozy-ui/transpiled/react/Dialog'
import Divider from 'cozy-ui/transpiled/react/Divider'
import Icon from 'cozy-ui/transpiled/react/Icon'
import { makeStyles } from 'cozy-ui/transpiled/react/styles'

import Sharing from '@/components/EditorToolbar/Sharing'
import { useRedirectLink } from '@/hooks/useRedirectLink'
import EditorTitleStart from '@/modules/views/editor/EditorTitleStart'

// Match the OnlyOffice editor: keep the title bar a fixed 3rem tall on its paper
// background.
const useStyles = makeStyles(theme => ({
  root: {
    width: '100%',
    height: '3rem',
    backgroundColor: theme.palette.background.paper
  }
}))

/**
 * Title bar shared by the full-screen editor views (PDF, Excalidraw): home
 * link, back button (flushing pending changes first), file type icon, file name
 * with its parent path, optional toolbar actions, and sharing.
 */
const EditorTitle = ({
  file,
  flushRef,
  icon,
  dataTestId,
  isPublic = false,
  isReadOnly = false,
  children
}) => {
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
        data-testid={dataTestId}
        disableTypography
        className="u-ellipsis u-flex u-flex-items-center u-p-0 u-pr-1"
        classes={styles}
      >
        <EditorTitleStart
          file={file}
          icon={<Icon className="u-ml-half" icon={icon} size={32} />}
          isPublic={isPublic}
          isReadOnly={isReadOnly}
          canRedirect={canRedirect}
          onBack={handleBack}
        />
        {children}
        {!isPublic && <Sharing file={file} />}
      </DialogTitle>
      <Divider />
    </div>
  )
}

EditorTitle.propTypes = {
  file: PropTypes.object.isRequired,
  flushRef: PropTypes.object,
  icon: PropTypes.oneOfType([PropTypes.func, PropTypes.object]).isRequired,
  dataTestId: PropTypes.string,
  isPublic: PropTypes.bool,
  isReadOnly: PropTypes.bool,
  children: PropTypes.node
}

export default React.memo(EditorTitle)
