import cx from 'classnames'
import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react'

import ClickAwayListener from 'cozy-ui/transpiled/react/ClickAwayListener'
import Drawer from 'cozy-ui/transpiled/react/Drawer'
import Fade from 'cozy-ui/transpiled/react/Fade'
import Paper from 'cozy-ui/transpiled/react/Paper'
import Popper from 'cozy-ui/transpiled/react/Popper'
import Portal from 'cozy-ui/transpiled/react/Portal'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'
import { useCozyTheme } from 'cozy-ui-plus/dist/providers/CozyTheme'
import { useI18n } from 'twake-i18n'

import styles from './styles.styl'

import { ScribeIntent } from '@/modules/views/OnlyOffice/Scribe/ScribeIntent'
import {
  useScribe,
  useScribeGeometry
} from '@/modules/views/OnlyOffice/Scribe/ScribeProvider'

const GAP = 12
const EDGE_PADDING = 8
const VEIL_FADE = 160
const SWIPE_TO_CLOSE = 60
const NO_RECT = { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

// The part of the selection inside the viewer, in the page
const findAnchorRect = geometry => {
  const { selection, viewer, frame } = geometry ?? {}
  if (!selection?.rect || !viewer || !frame) return null

  const { rect } = selection
  const right = viewer.left + viewer.width
  const bottom = viewer.top + viewer.height
  const x0 = clamp(rect.left, viewer.left, right)
  const x1 = clamp(rect.left + rect.width, viewer.left, right)
  const y0 = clamp(rect.top, viewer.top, bottom)
  const y1 = clamp(rect.top + rect.height, viewer.top, bottom)
  return {
    left: frame.left + x0,
    top: frame.top + y0,
    right: frame.left + x1,
    bottom: frame.top + y1,
    width: x1 - x0,
    height: y1 - y0
  }
}

// The reference Popper.js reads at each of its updates, which the Popper of
// cozy-ui runs at each render
const makeVirtualElement = () => {
  let rect = NO_RECT
  return {
    setRect: next => {
      rect = next
    },
    getBoundingClientRect: () => rect,
    get clientWidth() {
      return rect.width
    },
    get clientHeight() {
      return rect.height
    }
  }
}

const makeModifiers = arrow => ({
  offset: { offset: `0, ${GAP}` },
  flip: { behavior: ['bottom', 'top'] },
  preventOverflow: { padding: EDGE_PADDING, boundariesElement: 'window' },
  arrow: { enabled: arrow !== null, element: arrow }
})

const isOutOfViewer = (rect, viewer) =>
  rect.left > viewer.left + viewer.width ||
  rect.left + rect.width < viewer.left ||
  rect.top > viewer.top + viewer.height ||
  rect.top + rect.height < viewer.top

// A cursor alone has no selection, as after a click in the document; a
// selection scrolled out of the viewer leaves nothing to point at
const hasLostSelection = geometry => {
  if (geometry === null) return false
  const { selection, viewer } = geometry
  return selection === null || isOutOfViewer(selection.rect, viewer)
}

const useCloseOnLostSelection = (geometry, onClose) => {
  const isLost = hasLostSelection(geometry)

  useEffect(() => {
    if (isLost) onClose()
  }, [isLost, onClose])
}

const ScribeAnchoredPopover = ({ label, onClose, children }) => {
  const { type: themeType } = useCozyTheme()
  const geometry = useScribeGeometry()
  const rect = findAnchorRect(geometry)
  const popperRef = useRef(null)
  // In state: the Portal of the Popper mounts the content one commit later,
  // once the effects of the first one have run
  const [paper, setPaper] = useState(null)
  const [arrow, setArrow] = useState(null)
  const [anchorEl] = useState(makeVirtualElement)
  const modifiers = useMemo(() => makeModifiers(arrow), [arrow])
  useCloseOnLostSelection(geometry, onClose)

  // Before the first update of Popper.js, deferred to a microtask, and the
  // next ones, run by the Popper in a passive effect
  useLayoutEffect(() => {
    if (rect !== null) anchorEl.setRect(rect)
  })

  // A key typed in the assistant stays in its frame: the assistant closes
  // itself on Escape
  useEffect(() => {
    const handleKeyDown = event => {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // The compact scribe grows with its answer: placed above the selection,
  // the popover moves up with it
  useEffect(() => {
    if (paper === null || typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(() => {
      popperRef.current?.scheduleUpdate()
    })
    observer.observe(paper)
    return () => observer.disconnect()
  }, [paper])

  return (
    <Popper
      open
      anchorEl={anchorEl}
      placement="bottom-start"
      modifiers={modifiers}
      popperRef={popperRef}
      // Out of the element that holds the class of the theme: set it again,
      // as the Dialog of cozy-ui does
      className={cx(`TwakeTheme--${themeType}`, styles['scribe-popover'])}
      role="dialog"
      aria-label={label}
      data-testid="scribe-popover"
    >
      <ClickAwayListener onClickAway={onClose}>
        <div>
          <span ref={setArrow} className={styles['scribe-popover-arrow']} />
          <Paper
            ref={setPaper}
            elevation={8}
            className={styles['scribe-popover-paper']}
          >
            <div className={styles['scribe-popover-body']}>{children}</div>
          </Paper>
        </div>
      </ClickAwayListener>
    </Popper>
  )
}

const ScribeDrawer = ({ label, onClose, children }) => {
  const { type: themeType } = useCozyTheme()
  const touchStartY = useRef(null)
  useCloseOnLostSelection(useScribeGeometry(), onClose)

  const handleTouchStart = event => {
    touchStartY.current = event.touches[0]?.clientY ?? null
  }
  const handleTouchEnd = event => {
    const endY = event.changedTouches[0]?.clientY
    if (
      touchStartY.current !== null &&
      endY - touchStartY.current > SWIPE_TO_CLOSE
    ) {
      onClose()
    }
    touchStartY.current = null
  }

  return (
    <Drawer
      anchor="bottom"
      open
      onClose={onClose}
      className={cx(`TwakeTheme--${themeType}`, styles['scribe-drawer-root'])}
      PaperProps={{
        className: cx('u-ov-hidden', styles['scribe-drawer']),
        role: 'dialog',
        'aria-label': label,
        'data-testid': 'scribe-drawer'
      }}
    >
      {/* Escape and a tap out of the drawer close it too */}
      <div
        className={cx(
          'u-flex u-flex-justify-center',
          styles['scribe-drawer-handle']
        )}
        aria-hidden="true"
        data-testid="scribe-drawer-handle"
        onClick={onClose}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      />
      <div className={styles['scribe-drawer-body']}>{children}</div>
    </Drawer>
  )
}

/**
 * The scribe on the selected text: a popover anchored to the selection, or
 * a drawer at the bottom of a small screen. The assistant shows in its
 * compact layout, and asks for the panel to go on there.
 */
export const ScribePopover = () => {
  const { t } = useI18n()
  const { isMobile } = useBreakpoints()
  const { isPopoverOpen, popoverSource, closePopover, applyResult } =
    useScribe()

  const label = t('OnlyOffice.scribe.selectionMenu')
  const Surface = isMobile ? ScribeDrawer : ScribeAnchoredPopover

  // The intent is made here, out of the components that follow the
  // geometry: it is not rendered again as the selection moves. The veil
  // stays mounted until it has faded out.
  return (
    <>
      <Portal into="body">
        <Fade in={isPopoverOpen && !isMobile} timeout={VEIL_FADE} unmountOnExit>
          <div
            className={cx('u-pos-fixed', styles['scribe-popover-veil'])}
            data-testid="scribe-popover-veil"
          />
        </Fade>
      </Portal>
      {isPopoverOpen && (
        <Surface label={label} onClose={closePopover}>
          <ScribeIntent
            layout="compact"
            source={popoverSource}
            onResult={applyResult}
            onCancel={closePopover}
          />
        </Surface>
      )}
    </>
  )
}
