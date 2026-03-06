import React, { useState, useCallback, useRef, useMemo, forwardRef, useImperativeHandle } from 'react'
import PropTypes from 'prop-types'

import { useI18n } from 'twake-i18n'
import { useTheme } from 'cozy-ui/transpiled/react/styles'
import Icon from 'cozy-ui/transpiled/react/Icon'
import RightIcon from 'cozy-ui/transpiled/react/Icons/Right'
import InputBase from 'cozy-ui/transpiled/react/InputBase'
import ListItem from 'cozy-ui/transpiled/react/ListItem'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'
import Paper from 'cozy-ui/transpiled/react/Paper'

import { SCRIBE_ACTIONS, buildTranslateChildren } from '@/modules/views/OnlyOffice/Scribe/scribeActions'
import { ScribePromptInput } from '@/modules/views/OnlyOffice/Scribe/ScribePromptInput'

const PROMPT_INDEX = SCRIBE_ACTIONS.length

const ScribeActionMenu = forwardRef(({ onSelect, onClose, selectedText: _selectedText }, ref) => {
  const { t, lang } = useI18n()
  const theme = useTheme()
  const [activeSubmenu, setActiveSubmenu] = useState(null)
  const [focusIndex, setFocusIndex] = useState(0)
  const [submenuFocusIndex, setSubmenuFocusIndex] = useState(0)
  const [customLang, setCustomLang] = useState('')
  const paperRef = useRef(null)
  const promptRef = useRef(null)
  const customLangRef = useRef(null)

  // Build actions with dynamic translate children
  const actions = useMemo(() => {
    const translateChildren = buildTranslateChildren(lang)
    return SCRIBE_ACTIONS.map(action =>
      action.id === 'translate' ? { ...action, children: translateChildren } : action
    )
  }, [lang])

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
  }, [focusMenu, focusPrompt])

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
      if (direction === 'up') {
        updateFocus(actions.length - 1)
      } else {
        updateFocus(0)
      }
    },
    [updateFocus, actions.length]
  )

  const handleKeyDown = useCallback(
    e => {
      // Ignore keydown events from the prompt input (it handles its own arrows)
      if (focusIndex === PROMPT_INDEX) return

      const actionCount = actions.length

      if (activeSubmenu) {
        const parent = actions.find(a => a.id === activeSubmenu)
        const children = parent ? parent.children : []
        const childCount = children.length

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
      } else {
        switch (e.key) {
          case 'ArrowDown':
            e.preventDefault()
            updateFocus((focusIndex + 1) % (actionCount + 1))
            break
          case 'ArrowUp':
            e.preventDefault()
            updateFocus((focusIndex - 1 + actionCount + 1) % (actionCount + 1))
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
          case 'Enter': {
            e.preventDefault()
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
    [activeSubmenu, focusIndex, submenuFocusIndex, selectAction, onClose, updateFocus, actions, handleCustomLangSubmit, focusMenu]
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
      <Paper
        ref={paperRef}
        tabIndex={-1}
        style={{ minWidth: 220, outline: 'none', borderRadius: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}
        elevation={0}
        onKeyDown={handleKeyDown}
      >
        {actions.map((action, index) => (
          <div
            key={action.id}
            onMouseEnter={() => {
              setFocusIndex(index)
              if (action.children) { setActiveSubmenu(action.id); setSubmenuFocusIndex(-1) }
            }}
            onMouseLeave={() => {
              if (action.children) setActiveSubmenu(null)
            }}
            style={{ position: 'relative' }}
          >
            <ListItem
              button
              selected={(focusIndex === index && !activeSubmenu) || activeSubmenu === action.id}
              style={{
                ...(index === 0 ? { borderRadius: '8px 8px 0 0' } : {}),
                ...(index === actions.length - 1 ? { borderRadius: '0 0 8px 8px' } : {})
              }}
              onClick={
                !action.children
                  ? () => { const label = t(action.labelKey); onSelect(action.id, label, label) }
                  : () => {
                      setActiveSubmenu(action.id)
                      setSubmenuFocusIndex(0)
                    }
              }
            >
              <ListItemIcon>
                <Icon icon={action.icon} />
              </ListItemIcon>
              <ListItemText primary={t(action.labelKey)} />
              {action.children && <Icon icon={RightIcon} size={16} />}
            </ListItem>

            {action.children && activeSubmenu === action.id && (
              <Paper
                style={{
                  position: 'absolute',
                  left: '100%',
                  top: 0,
                  minWidth: 180,
                  zIndex: 1
                }}
                elevation={4}
              >
                {action.children.map((child, childIndex) =>
                  child.type === 'input' ? (
                    <ListItem
                      button
                      key={child.id}
                      selected={submenuFocusIndex === childIndex}
                      onMouseEnter={() => {
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
                      onMouseEnter={() => setSubmenuFocusIndex(childIndex)}
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
        ))}
      </Paper>
      <Paper
        style={{
          width: 500,
          borderRadius: 8,
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          transition: 'background-color 150ms',
          backgroundColor: focusIndex === PROMPT_INDEX
            ? ((theme.palette.type || theme.palette.mode) === 'dark' ? theme.palette.grey[700] : theme.palette.grey[200])
            : undefined
        }}
        elevation={0}
        onMouseEnter={() => updateFocus(PROMPT_INDEX)}
      >
        <ScribePromptInput
          ref={promptRef}
          onSubmit={handlePromptSubmit}
          onArrow={handlePromptArrow}
          onEscape={onClose}
        />
      </Paper>
    </div>
  )
})

ScribeActionMenu.displayName = 'ScribeActionMenu'

ScribeActionMenu.propTypes = {
  onSelect: PropTypes.func.isRequired,
  onClose: PropTypes.func,
  selectedText: PropTypes.string
}

ScribeActionMenu.defaultProps = {
  selectedText: '',
  onClose: null
}

export { ScribeActionMenu }
