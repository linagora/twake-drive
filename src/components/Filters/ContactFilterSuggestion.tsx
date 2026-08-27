import React, { type ReactElement } from 'react'

import ListItem from 'cozy-ui/transpiled/react/ListItem'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'

import styles from './ContactFilter.styl'
import type { ContactFilterOption } from './ContactFilter.types'

interface ContactFilterSuggestionProps {
  currentUserLabel: string
  highlighted: boolean
  option: ContactFilterOption
}

const ContactFilterSuggestion = ({
  currentUserLabel,
  highlighted,
  option
}: ContactFilterSuggestionProps): ReactElement => {
  const primaryLabel = option.isCurrentUser
    ? `${option.label} (${currentUserLabel})`
    : option.label

  return (
    <ListItem
      button
      className={highlighted ? styles.suggestionHighlighted : undefined}
    >
      <ListItemIcon>{option.avatar}</ListItemIcon>
      <ListItemText primary={primaryLabel} secondary={option.secondaryLabel} />
    </ListItem>
  )
}

export { ContactFilterSuggestion }
