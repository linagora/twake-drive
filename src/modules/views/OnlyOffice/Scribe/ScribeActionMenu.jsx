import React, { useState, useCallback, useRef, useMemo, useEffect, forwardRef, useImperativeHandle } from 'react'
import PropTypes from 'prop-types'

import { useI18n } from 'twake-i18n'
import { useTheme } from 'cozy-ui/transpiled/react/styles'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'
import Icon from 'cozy-ui/transpiled/react/Icon'
import BugIcon from 'cozy-ui/transpiled/react/Icons/BugReport'
import LeftIcon from 'cozy-ui/transpiled/react/Icons/Left'
import RightIcon from 'cozy-ui/transpiled/react/Icons/Right'
import InputBase from 'cozy-ui/transpiled/react/InputBase'
import ListItem from 'cozy-ui/transpiled/react/ListItem'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'
import Paper from 'cozy-ui/transpiled/react/Paper'

import { SCRIBE_ACTIONS, buildTranslateChildren, OPEN_PANEL_ENTRY } from '@/modules/views/OnlyOffice/Scribe/scribeActions'
import { ScribePromptInput } from '@/modules/views/OnlyOffice/Scribe/ScribePromptInput'
import { isScribeDevMd } from '@/modules/views/OnlyOffice/Scribe/scribeDevMode'

const DEV_MD_ACTION = {
  id: 'test-markdown',
  labelKey: null,
  label: 'Test MD',
  icon: BugIcon,
  children: null,
  prompt: null,
  mockResult: null
}

const PanelIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
    <line x1="10" y1="2.5" x2="10" y2="13.5" stroke="currentColor" strokeWidth="1.2" />
  </svg>
)

const ScribeActionMenu = forwardRef(({ onSelect, onClose, onOpenPanel, selectedText: _selectedText }, ref) => {
  const { t, lang } = useI18n()
  const theme = useTheme()
  const { isMobile } = useBreakpoints()
  const [activeSubmenu, setActiveSubmenu] = useState(null)
  const [focusIndex, setFocusIndex] = useState(0)
  const [submenuFocusIndex, setSubmenuFocusIndex] = useState(0)
  const [customLang, setCustomLang] = useState('')
  const paperRef = useRef(null)
  const promptRef = useRef(null)
  const customLangRef = useRef(null)
  const mouseMoveEnabledRef = useRef(false)

  // Gate mouse hover: suppress highlight until mouse physically moves after menu opens
  useEffect(() => {
    mouseMoveEnabledRef.current = false
    const paper = paperRef.current
    if (!paper) return

    const enableMouse = () => {
      mouseMoveEnabledRef.current = true
      paper.removeEventListener('mousemove', enableMouse)
    }
    paper.addEventListener('mousemove', enableMouse)

    return () => {
      paper.removeEventListener('mousemove', enableMouse)
    }
  }, [])

  // Build actions with dynamic translate children + optional dev action
  const actions = useMemo(() => {
    const translateChildren = buildTranslateChildren(lang)
    const base = SCRIBE_ACTIONS.map(action =>
      action.id === 'translate' ? { ...action, children: translateChildren } : action
    )
    return isScribeDevMd() ? [DEV_MD_ACTION, ...base] : base
  }, [lang])

  // Roving indices after the LLM actions: the free-prompt sits at PROMPT_INDEX,
  // and the optional "open panel" entry (D-06) sits right after it. The open-panel
  // entry only exists when `onOpenPanel` is wired (mirror of the old icon guard).
  const PROMPT_INDEX = actions.length
  const hasOpenPanel = Boolean(onOpenPanel)
  const OPEN_PANEL_INDEX = hasOpenPanel ? PROMPT_INDEX + 1 : -1
  // Number of roving slots in the desktop main list: actions + prompt (+ open-panel)
  const rovingCount = actions.length + 1 + (hasOpenPanel ? 1 : 0)
  const activeParent = isMobile && activeSubmenu ? actions.find(a => a.id === activeSubmenu) : null

  // Expose focus() to parent via ref
  useImperativeHandle(ref, () => ({
    focus: () => {
      if (paperRef.current) paperRef.current.focus()
    }
  }))

  const focusMenu = useCallback(() => {
    if (paperRef.current) paperRef.current.focus()
  }, [])

  const focusPrompt = useCallback(() => {
    if (promptRef.current) promptRef.current.focus()
  }, [])

  // When focusIndex changes, move DOM focus accordingly
  const updateFocus = useCallback((newIndex) => {
    setFocusIndex(newIndex)
    if (newIndex === PROMPT_INDEX) {
      setTimeout(() => focusPrompt(), 0)
    } else {
      focusMenu()
    }
  }, [focusMenu, focusPrompt, PROMPT_INDEX])

  const handlePromptSubmit = useCallback(
    prompt => {
      onSelect('free-prompt', prompt, prompt)
    },
    [onSelect]
  )

  const selectAction = useCallback(
    (action, child) => {
      if (child) {
        const childLabel = child.labelKey ? t(child.labelKey) : child.label
        const parentLabel = t(action.labelKey)
        onSelect(child.id, childLabel, `${parentLabel} > ${childLabel}`)
      } else if (!action.children) {
        const label = t(action.labelKey)
        onSelect(action.id, label, label)
      }
    },
    [onSelect, t]
  )

  const handleCustomLangSubmit = useCallback(() => {
    const trimmed = customLang.trim()
    if (trimmed) {
      const translateLabel = t(actions.find(a => a.id === 'translate').labelKey)
      onSelect('translate-custom', trimmed, `${translateLabel} > ${trimmed}`)
      setCustomLang('')
    }
  }, [customLang, onSelect, t, actions])

  // Called by ScribePromptInput when arrow keys are pressed in the input
  const handlePromptArrow = useCallback(
    direction => {
      if (isMobile && activeSubmenu) {
        // In mobile submenu: arrow from prompt goes to last child (up) or back button (down)
        const parent = actions.find(a => a.id === activeSubmenu)
        const children = parent ? parent.children : []
        if (direction === 'up') {
          const last = children.length - 1
          setSubmenuFocusIndex(last)
          if (children[last] && children[last].type === 'input') {
            setTimeout(() => { if (customLangRef.current) customLangRef.current.focus() }, 0)
          } else {
            focusMenu()
          }
        } else {
          setSubmenuFocusIndex(-1)
          focusMenu()
        }
      } else {
        if (direction === 'up') {
          updateFocus(actions.length - 1)
        } else {
          // 'down' from the prompt moves to the open-panel entry when present,
          // otherwise wraps to the first action (D-05 roving).
          updateFocus(hasOpenPanel ? OPEN_PANEL_INDEX : 0)
        }
      }
    },
    [updateFocus, actions, isMobile, activeSubmenu, focusMenu, hasOpenPanel, OPEN_PANEL_INDEX]
  )

  const handleKeyDown = useCallback(
    e => {
      // Ignore keydown events from the prompt input (it handles its own arrows)
      if (focusIndex === PROMPT_INDEX) return

      if (activeSubmenu) {
        const parent = actions.find(a => a.id === activeSubmenu)
        const children = parent ? parent.children : []
        const childCount = children.length

        // Mobile submenu navigation: back button (-1), children (0..n-1), prompt (n)
        // Desktop submenu navigation: children only (0..n-1), wrapping
        const BACK_INDEX = -1
        const PROMPT_SUBMENU_INDEX = childCount

        if (isMobile) {
          // Mobile: extended range includes back button and prompt
          const goBack = () => { setActiveSubmenu(null); setSubmenuFocusIndex(0); focusMenu() }

          // If on prompt input, only handle arrows to leave it
          if (submenuFocusIndex === PROMPT_SUBMENU_INDEX) {
            if (e.key === 'ArrowUp') {
              e.preventDefault()
              const prev = childCount - 1
              setSubmenuFocusIndex(prev)
              if (children[prev] && children[prev].type === 'input') {
                setTimeout(() => { if (customLangRef.current) customLangRef.current.focus() }, 0)
              } else {
                focusMenu()
              }
            } else if (e.key === 'ArrowDown') {
              e.preventDefault()
              setSubmenuFocusIndex(BACK_INDEX)
              focusMenu()
            } else if (e.key === 'ArrowLeft' || e.key === 'Escape') {
              e.preventDefault()
              e.stopPropagation()
              goBack()
            }
            return
          }

          // If on back button
          if (submenuFocusIndex === BACK_INDEX) {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setSubmenuFocusIndex(0)
              if (children[0] && children[0].type === 'input') {
                setTimeout(() => { if (customLangRef.current) customLangRef.current.focus() }, 0)
              }
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setSubmenuFocusIndex(PROMPT_SUBMENU_INDEX)
              setTimeout(() => focusPrompt(), 0)
            } else if (e.key === 'Enter' || e.key === 'ArrowLeft') {
              e.preventDefault()
              goBack()
            } else if (e.key === 'Escape') {
              e.preventDefault()
              e.stopPropagation()
              goBack()
            }
            return
          }

          // If on custom input child
          const focusedChild = children[submenuFocusIndex]
          if (focusedChild && focusedChild.type === 'input') {
            if (e.key === 'ArrowUp') {
              e.preventDefault()
              const prev = submenuFocusIndex - 1
              if (prev < 0) {
                setSubmenuFocusIndex(BACK_INDEX)
              } else {
                setSubmenuFocusIndex(prev)
              }
              focusMenu()
            } else if (e.key === 'ArrowDown') {
              e.preventDefault()
              const next = submenuFocusIndex + 1
              if (next >= childCount) {
                setSubmenuFocusIndex(PROMPT_SUBMENU_INDEX)
                setTimeout(() => focusPrompt(), 0)
              } else {
                setSubmenuFocusIndex(next)
                focusMenu()
              }
            } else if (e.key === 'ArrowLeft' || e.key === 'Escape') {
              e.preventDefault()
              e.stopPropagation()
              goBack()
            } else if (e.key === 'Enter') {
              e.preventDefault()
              handleCustomLangSubmit()
            }
            return
          }

          // Normal child item on mobile
          switch (e.key) {
            case 'ArrowDown':
              e.preventDefault()
              {
                const next = submenuFocusIndex + 1
                if (next >= childCount) {
                  setSubmenuFocusIndex(PROMPT_SUBMENU_INDEX)
                  setTimeout(() => focusPrompt(), 0)
                } else {
                  setSubmenuFocusIndex(next)
                  if (children[next] && children[next].type === 'input') {
                    setTimeout(() => { if (customLangRef.current) customLangRef.current.focus() }, 0)
                  }
                }
              }
              break
            case 'ArrowUp':
              e.preventDefault()
              {
                const prev = submenuFocusIndex - 1
                if (prev < 0) {
                  setSubmenuFocusIndex(BACK_INDEX)
                } else {
                  setSubmenuFocusIndex(prev)
                  if (children[prev] && children[prev].type === 'input') {
                    setTimeout(() => { if (customLangRef.current) customLangRef.current.focus() }, 0)
                  }
                }
              }
              break
            case 'Enter':
              e.preventDefault()
              if (parent) {
                selectAction(parent, children[submenuFocusIndex])
              }
              break
            case 'ArrowLeft':
            case 'Escape':
              e.preventDefault()
              e.stopPropagation()
              goBack()
              break
            default:
              break
          }
        } else {
          // Desktop: submenu wraps within children only

          // If focus is on the custom input, handle differently
          const focusedChild = children[submenuFocusIndex]
          if (focusedChild && focusedChild.type === 'input') {
            // Let the input handle most keys, only intercept navigation
            if (e.key === 'ArrowUp') {
              e.preventDefault()
              setSubmenuFocusIndex(i => (i - 1 + childCount) % childCount)
              focusMenu()
            } else if (e.key === 'ArrowDown') {
              e.preventDefault()
              setSubmenuFocusIndex(i => (i + 1) % childCount)
              focusMenu()
            } else if (e.key === 'ArrowLeft') {
              e.preventDefault()
              setActiveSubmenu(null)
              focusMenu()
            } else if (e.key === 'Escape') {
              e.preventDefault()
              e.stopPropagation()
              setActiveSubmenu(null)
              focusMenu()
            } else if (e.key === 'Enter') {
              e.preventDefault()
              handleCustomLangSubmit()
            }
            return
          }

          switch (e.key) {
            case 'ArrowDown':
              e.preventDefault()
              {
                const next = (submenuFocusIndex + 1) % childCount
                setSubmenuFocusIndex(next)
                if (children[next] && children[next].type === 'input') {
                  setTimeout(() => { if (customLangRef.current) customLangRef.current.focus() }, 0)
                }
              }
              break
            case 'ArrowUp':
              e.preventDefault()
              {
                const prev = (submenuFocusIndex - 1 + childCount) % childCount
                setSubmenuFocusIndex(prev)
                if (children[prev] && children[prev].type === 'input') {
                  setTimeout(() => { if (customLangRef.current) customLangRef.current.focus() }, 0)
                }
              }
              break
            case 'ArrowLeft':
              e.preventDefault()
              setActiveSubmenu(null)
              break
            case 'Enter':
              e.preventDefault()
              if (parent) {
                selectAction(parent, parent.children[submenuFocusIndex])
              }
              break
            case 'Escape':
              e.preventDefault()
              e.stopPropagation()
              setActiveSubmenu(null)
              break
            default:
              break
          }
        }
      } else {
        // Main-list roving spans the actions (0..actionCount-1), the prompt
        // (PROMPT_INDEX) and the optional open-panel entry (OPEN_PANEL_INDEX).
        switch (e.key) {
          case 'ArrowDown':
            e.preventDefault()
            updateFocus((focusIndex + 1) % rovingCount)
            break
          case 'ArrowUp':
            e.preventDefault()
            updateFocus((focusIndex - 1 + rovingCount) % rovingCount)
            break
          case 'ArrowRight': {
            e.preventDefault()
            const action = actions[focusIndex]
            if (action && action.children) {
              setActiveSubmenu(action.id)
              setSubmenuFocusIndex(0)
            }
            break
          }
          case 'Enter':
          case ' ': {
            e.preventDefault()
            if (focusIndex === OPEN_PANEL_INDEX) {
              if (onOpenPanel) onOpenPanel()
              break
            }
            const action = actions[focusIndex]
            if (action) {
              if (action.children) {
                setActiveSubmenu(action.id)
                setSubmenuFocusIndex(0)
              } else {
                selectAction(action)
              }
            }
            break
          }
          case 'Escape':
            e.preventDefault()
            if (onClose) onClose()
            break
          default:
            break
        }
      }
    },
    [activeSubmenu, focusIndex, submenuFocusIndex, selectAction, onClose, updateFocus, actions, handleCustomLangSubmit, focusMenu, focusPrompt, isMobile, rovingCount, OPEN_PANEL_INDEX, onOpenPanel]
  )

  // Background highlight for a roving target (prompt / open-panel) when focused.
  const focusedBg = (theme.palette.type || theme.palette.mode) === 'dark'
    ? theme.palette.grey[700]
    : theme.palette.grey[200]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
      <Paper
        ref={paperRef}
        tabIndex={-1}
        style={{ minWidth: isMobile ? undefined : 220, width: isMobile ? '100%' : undefined, outline: 'none', borderRadius: isMobile ? 0 : 8, boxShadow: isMobile ? 'none' : '0 4px 20px rgba(0,0,0,0.15)' }}
        elevation={0}
        onKeyDown={handleKeyDown}
      >
        {isMobile && activeParent ? (
          // Mobile: submenu replaces main menu entirely
          <>
            <ListItem
              button
              selected={submenuFocusIndex === -1}
              onClick={() => { setActiveSubmenu(null); setSubmenuFocusIndex(0); focusMenu() }}
            >
              <ListItemIcon>
                <Icon icon={LeftIcon} />
              </ListItemIcon>
              <ListItemText primary={t(activeParent.labelKey)} />
            </ListItem>
            {activeParent.children.map((child, childIndex) =>
              child.type === 'input' ? (
                <ListItem
                  button
                  key={child.id}
                  selected={submenuFocusIndex === childIndex}
                  onClick={() => {
                    if (customLangRef.current) customLangRef.current.focus()
                  }}
                >
                  <InputBase
                    inputRef={customLangRef}
                    placeholder={t(child.placeholderKey)}
                    value={customLang}
                    onChange={e => setCustomLang(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        e.stopPropagation()
                        handleCustomLangSubmit()
                      } else if (e.key === 'Escape') {
                        e.preventDefault()
                        e.stopPropagation()
                        setActiveSubmenu(null)
                        focusMenu()
                      }
                    }}
                    onFocus={() => setSubmenuFocusIndex(childIndex)}
                    fullWidth
                    style={{ fontSize: 14 }}
                  />
                </ListItem>
              ) : (
                <ListItem
                  button
                  key={child.id}
                  selected={submenuFocusIndex === childIndex}
                  onClick={() => {
                    const childLabel = child.labelKey ? t(child.labelKey) : child.label
                    const parentLabel = t(activeParent.labelKey)
                    onSelect(child.id, childLabel, `${parentLabel} > ${childLabel}`)
                  }}
                >
                  {child.icon && (
                    <ListItemIcon>
                      {child.icon === 'emoji' ? (
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                          <circle cx="5.5" cy="6.5" r="1" fill="currentColor" />
                          <circle cx="10.5" cy="6.5" r="1" fill="currentColor" />
                          <path d="M5 10c.5 1.5 2 2.5 3 2.5s2.5-1 3-2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                        </svg>
                      ) : (
                        <Icon icon={child.icon} />
                      )}
                    </ListItemIcon>
                  )}
                  <ListItemText primary={child.labelKey ? t(child.labelKey) : child.label} />
                </ListItem>
              )
            )}
          </>
        ) : (
          // Desktop: main menu with flyout submenus
          actions.map((action, index) => (
            <div
              key={action.id}
              onMouseEnter={() => {
                if (!mouseMoveEnabledRef.current) return
                setFocusIndex(index)
                if (action.children) { setActiveSubmenu(action.id); setSubmenuFocusIndex(-1) }
              }}
              onMouseLeave={() => {
                if (!mouseMoveEnabledRef.current) return
                if (action.children) setActiveSubmenu(null)
              }}
              style={{ position: 'relative' }}
            >
              <ListItem
                button
                selected={(focusIndex === index && !activeSubmenu) || activeSubmenu === action.id}
                style={{
                  // First action keeps the top corners; the bottom corners now
                  // belong to the open-panel entry (or the prompt) at the end of
                  // the list, so actions never take the last-item radius.
                  ...(index === 0 ? { borderRadius: '8px 8px 0 0' } : {})
                }}
                onClick={
                  !action.children
                    ? () => { const label = action.labelKey ? t(action.labelKey) : action.label; onSelect(action.id, label, label) }
                    : () => {
                        setActiveSubmenu(action.id)
                        setSubmenuFocusIndex(0)
                      }
                }
              >
                <ListItemIcon>
                  <Icon icon={action.icon} />
                </ListItemIcon>
                <ListItemText primary={action.labelKey ? t(action.labelKey) : action.label} />
                {action.children && <Icon icon={RightIcon} size={16} />}
              </ListItem>

              {action.children && activeSubmenu === action.id && (
                <Paper
                  style={{ position: 'absolute', left: '100%', top: 0, minWidth: 180, zIndex: 1 }}
                  elevation={4}
                >
                  {action.children.map((child, childIndex) =>
                    child.type === 'input' ? (
                      <ListItem
                        button
                        key={child.id}
                        selected={submenuFocusIndex === childIndex}
                        onMouseEnter={() => {
                          if (!mouseMoveEnabledRef.current) return
                          setSubmenuFocusIndex(childIndex)
                          if (customLangRef.current) customLangRef.current.focus()
                        }}
                        onClick={() => {
                          if (customLangRef.current) customLangRef.current.focus()
                        }}
                        style={{
                          ...(childIndex === action.children.length - 1 ? { borderRadius: '0 0 4px 4px' } : {})
                        }}
                      >
                        <InputBase
                          inputRef={customLangRef}
                          placeholder={t(child.placeholderKey)}
                          value={customLang}
                          onChange={e => setCustomLang(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              e.stopPropagation()
                              handleCustomLangSubmit()
                            } else if (e.key === 'Escape') {
                              e.preventDefault()
                              e.stopPropagation()
                              setActiveSubmenu(null)
                              focusMenu()
                            }
                          }}
                          onFocus={() => setSubmenuFocusIndex(childIndex)}
                          fullWidth
                          style={{ fontSize: 14 }}
                        />
                      </ListItem>
                    ) : (
                      <ListItem
                        button
                        key={child.id}
                        selected={submenuFocusIndex === childIndex}
                        style={{
                          ...(childIndex === 0 ? { borderRadius: '4px 4px 0 0' } : {}),
                          ...(childIndex === action.children.length - 1 ? { borderRadius: '0 0 4px 4px' } : {})
                        }}
                        onClick={() => {
                          const childLabel = child.labelKey ? t(child.labelKey) : child.label
                          const parentLabel = t(action.labelKey)
                          onSelect(child.id, childLabel, `${parentLabel} > ${childLabel}`)
                        }}
                        onMouseEnter={() => { if (!mouseMoveEnabledRef.current) return; setSubmenuFocusIndex(childIndex) }}
                      >
                        {child.icon && (
                          <ListItemIcon>
                            {child.icon === 'emoji' ? (
                              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                                <circle cx="5.5" cy="6.5" r="1" fill="currentColor" />
                                <circle cx="10.5" cy="6.5" r="1" fill="currentColor" />
                                <path d="M5 10c.5 1.5 2 2.5 3 2.5s2.5-1 3-2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                              </svg>
                            ) : (
                              <Icon icon={child.icon} />
                            )}
                          </ListItemIcon>
                        )}
                        <ListItemText primary={child.labelKey ? t(child.labelKey) : child.label} />
                      </ListItem>
                    )
                  )}
                </Paper>
              )}
            </div>
          ))
        )}

        {/* The free-prompt and the open-panel entry are integrated list rows
            (D-04/D-05/D-06). They show on the main list only — never while a
            mobile submenu has replaced the main menu. */}
        {!(isMobile && activeParent) && (
          <>
            <div
              data-scribe-prompt-entry
              style={{
                transition: 'background-color 150ms',
                backgroundColor: focusIndex === PROMPT_INDEX ? focusedBg : undefined,
                // When the prompt is the last item (no open-panel entry), it
                // takes the bottom corners.
                ...(hasOpenPanel ? {} : { borderRadius: '0 0 8px 8px' })
              }}
              onMouseEnter={() => { if (!mouseMoveEnabledRef.current) return; updateFocus(PROMPT_INDEX) }}
            >
              <ScribePromptInput
                ref={promptRef}
                onSubmit={handlePromptSubmit}
                onArrow={handlePromptArrow}
                onEscape={onClose}
              />
            </div>

            {hasOpenPanel && (
              <ListItem
                button
                data-scribe-open-panel
                selected={focusIndex === OPEN_PANEL_INDEX && !activeSubmenu}
                style={{ borderRadius: '0 0 8px 8px' }}
                onClick={onOpenPanel}
                onMouseEnter={() => { if (!mouseMoveEnabledRef.current) return; setFocusIndex(OPEN_PANEL_INDEX); focusMenu() }}
              >
                <ListItemIcon>
                  <PanelIcon />
                </ListItemIcon>
                <ListItemText primary={t('Scribe.button.open_panel')} />
              </ListItem>
            )}
          </>
        )}
      </Paper>
    </div>
  )
})

ScribeActionMenu.displayName = 'ScribeActionMenu'

ScribeActionMenu.propTypes = {
  onSelect: PropTypes.func.isRequired,
  onClose: PropTypes.func,
  onOpenPanel: PropTypes.func,
  selectedText: PropTypes.string
}

ScribeActionMenu.defaultProps = {
  selectedText: '',
  onClose: null
}

export { ScribeActionMenu }
