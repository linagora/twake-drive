import React, { useState, useCallback } from 'react'
import PropTypes from 'prop-types'

import Divider from 'cozy-ui/transpiled/react/Divider'
import Icon from 'cozy-ui/transpiled/react/Icon'
import RightIcon from 'cozy-ui/transpiled/react/Icons/Right'
import ListItem from 'cozy-ui/transpiled/react/ListItem'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'
import Paper from 'cozy-ui/transpiled/react/Paper'

import { SCRIBE_ACTIONS } from '@/modules/views/OnlyOffice/Scribe/scribeActions'
import { ScribePromptInput } from '@/modules/views/OnlyOffice/Scribe/ScribePromptInput'

/**
 * ScribeActionMenu - Step 1 of the two-step Scribe flow.
 *
 * Renders a menu with 4 top-level actions (with icons and chevrons for submenu items),
 * nested submenus that open on hover to the right, and a free prompt input at the bottom.
 *
 * Layout:
 * +----------------------------------+
 * | [check] Correct grammar          |
 * | [globe] Translate             >  |
 * | [pen]   Change tone           >  |
 * | [magic] Improve               >  |
 * +----------------------------------+
 * | [input: "Help me write"] [send]  |
 * +----------------------------------+
 *
 * @param {Object} props
 * @param {Function} props.onSelect - Called with (actionId, label, breadcrumb)
 * @param {string} props.selectedText - The text selected in the editor
 */
const ScribeActionMenu = ({ onSelect, selectedText: _selectedText }) => {
  const [activeSubmenu, setActiveSubmenu] = useState(null)

  const handlePromptSubmit = useCallback(
    prompt => {
      onSelect('free-prompt', prompt, prompt)
    },
    [onSelect]
  )

  return (
    <Paper style={{ minWidth: 220 }} elevation={0}>
      {SCRIBE_ACTIONS.map(action => (
        <div
          key={action.id}
          onMouseEnter={() => action.children && setActiveSubmenu(action.id)}
          onMouseLeave={() => action.children && setActiveSubmenu(null)}
          style={{ position: 'relative' }}
        >
          <ListItem
            button
            onClick={
              !action.children
                ? () => onSelect(action.id, action.label, action.label)
                : undefined
            }
          >
            <ListItemIcon>
              <Icon icon={action.icon} />
            </ListItemIcon>
            <ListItemText primary={action.label} />
            {action.children && <Icon icon={RightIcon} size={16} />}
          </ListItem>

          {/* Submenu - rendered inside the same wrapper div to prevent flicker (Pitfall 2) */}
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
              {action.children.map(child => (
                <ListItem
                  button
                  key={child.id}
                  onClick={() =>
                    onSelect(
                      child.id,
                      child.label,
                      `${action.label} > ${child.label}`
                    )
                  }
                >
                  {child.icon && (
                    <ListItemIcon>
                      <Icon icon={child.icon} />
                    </ListItemIcon>
                  )}
                  <ListItemText
                    primary={child.label}
                    inset={!child.icon}
                  />
                </ListItem>
              ))}
            </Paper>
          )}
        </div>
      ))}
      <Divider />
      <ScribePromptInput onSubmit={handlePromptSubmit} />
    </Paper>
  )
}

ScribeActionMenu.propTypes = {
  onSelect: PropTypes.func.isRequired,
  selectedText: PropTypes.string
}

ScribeActionMenu.defaultProps = {
  selectedText: ''
}

export { ScribeActionMenu }
