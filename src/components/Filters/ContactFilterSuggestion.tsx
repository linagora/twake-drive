import React, { type ReactElement } from 'react'

import ListItem from 'cozy-ui/transpiled/react/ListItem'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'

import type { ContactFilterOption } from './ContactFilter.types'

interface ContactFilterSuggestionProps {
  currentUserLabel: string
  option: ContactFilterOption
}

const ContactFilterSuggestion = ({
  currentUserLabel,
  option
}: ContactFilterSuggestionProps): ReactElement => {
  const primaryLabel = option.isCurrentUser
    ? `${option.label} (${currentUserLabel})`
    : option.label

  return (
    <ListItem button>
      <ListItemIcon>{option.avatar}</ListItemIcon>
      <ListItemText primary={primaryLabel} secondary={option.secondaryLabel} />
    </ListItem>
  )
}

export { ContactFilterSuggestion }
