import React from 'react'
import PropTypes from 'prop-types'

import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'
import Popover from 'cozy-ui/transpiled/react/Popover'
import Drawer from 'cozy-ui/transpiled/react/Drawer'

/**
 * ScribeContainer - Breakpoint-conditional container for Scribe UI.
 *
 * On mobile (isMobile): renders a fullscreen bottom Drawer.
 * On desktop: renders the existing Popover with all props passed through.
 *
 * This component only handles the container shell — all content
 * (menu, loading, result) is passed as children.
 */
const ScribeContainer = ({ open, onClose, children, ...popoverProps }) => {
  const { isMobile } = useBreakpoints()

  if (isMobile) {
    return (
      <Drawer
        anchor="bottom"
        open={open}
        onClose={onClose}
        ModalProps={{
          disableScrollLock: true,
          disableEnforceFocus: true,
          disableAutoFocus: true
        }}
        PaperProps={{
          style: {
            height: '100%',
            borderRadius: 0,
            display: 'flex',
            flexDirection: 'column'
          }
        }}
        BackdropProps={{ style: { backgroundColor: 'rgba(0, 0, 0, 0.5)' } }}
      >
        {children}
      </Drawer>
    )
  }

  return (
    <Popover open={open} onClose={onClose} {...popoverProps}>
      {children}
    </Popover>
  )
}

ScribeContainer.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  children: PropTypes.node
}

export { ScribeContainer }
