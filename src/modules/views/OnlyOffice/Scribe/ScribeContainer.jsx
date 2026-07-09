import React, { useRef, useCallback } from 'react'
import PropTypes from 'prop-types'

import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'
import Popover from 'cozy-ui/transpiled/react/Popover'
import Drawer from 'cozy-ui/transpiled/react/Drawer'

const SWIPE_THRESHOLD = 60

/**
 * ScribeContainer - Breakpoint-conditional container for Scribe UI.
 *
 * On mobile (isMobile): renders a bottom Drawer (auto-height, max 85vh).
 * On desktop: renders the existing Popover with all props passed through.
 *
 * This component only handles the container shell — all content
 * (menu, loading, result) is passed as children.
 *
 * Why MUI Drawer instead of cozy-ui BottomSheet:
 * - BottomSheet is designed for progressive disclosure with 3 snap points
 *   (min/medium/max) — Scribe needs simple open/close, not variable
 *   snap positions. BottomSheet is not suited for this use case.
 * - BottomSheet always renders via Portal (@material-ui/core/Portal),
 *   which breaks the React context chain (theme, i18n, cozy-client)
 *   that Scribe children rely on.
 * - BottomSheet expects children wrapped in BottomSheetItem for proper
 *   styling — this would force layout changes across all three Scribe
 *   steps (menu, loading, result) for no functional benefit.
 * - Drawer gives direct control over open/close, focus management
 *   (disableEnforceFocus, disableAutoFocus), and transition callbacks
 *   (SlideProps) that Scribe's keyboard navigation depends on.
 */
const ScribeContainer = ({ open, onClose, children, TransitionProps, ...popoverProps }) => {
  const { isMobile } = useBreakpoints()
  const touchStartY = useRef(null)

  const handleTouchStart = useCallback(e => {
    touchStartY.current = e.touches[0].clientY
  }, [])

  const handleTouchEnd = useCallback(e => {
    if (touchStartY.current === null) return
    const deltaY = e.changedTouches[0].clientY - touchStartY.current
    touchStartY.current = null
    if (deltaY > SWIPE_THRESHOLD) {
      onClose()
    }
  }, [onClose])

  if (isMobile) {
    return (
      <Drawer
        anchor="bottom"
        open={open}
        onClose={onClose}
        SlideProps={TransitionProps}
        ModalProps={{
          disableScrollLock: true,
          disableEnforceFocus: true,
          disableAutoFocus: true
        }}
        PaperProps={{
          style: {
            maxHeight: '85vh',
            borderRadius: '12px 12px 0 0',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'auto'
          }
        }}
        BackdropProps={{ style: { backgroundColor: 'rgba(0, 0, 0, 0.5)' } }}
      >
        {/* Drag handle — tap or swipe down to close */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            padding: '12px 0 8px',
            flexShrink: 0,
            cursor: 'grab',
            touchAction: 'none'
          }}
          onClick={onClose}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div
            style={{
              width: 32,
              height: 4,
              borderRadius: 2,
              backgroundColor: 'rgba(128, 128, 128, 0.4)'
            }}
          />
        </div>
        {children}
      </Drawer>
    )
  }

  return (
    <Popover open={open} onClose={onClose} TransitionProps={TransitionProps} {...popoverProps}>
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
