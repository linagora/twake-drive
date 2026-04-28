import React, { useCallback } from 'react'

import ListItem from 'cozy-ui/transpiled/react/ListItem'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'

import { SHARED_DRIVES_DIR_ID } from '@/constants/config'
import FileIconMime from '@/modules/filelist/icons/FileIconMime'
import FileIconShortcut from '@/modules/filelist/icons/FileIconShortcut'
import SuggestionItemTextHighlighted from '@/modules/search/components/SuggestionItemTextHighlighted'
import SuggestionItemTextSecondary from '@/modules/search/components/SuggestionItemTextSecondary'

const SuggestionItem = ({
  suggestion,
  query,
  onClick,
  onParentOpened,
  isMobile = false
}) => {
  const openSuggestion = useCallback(() => {
    if (typeof onClick == 'function') {
      onClick(suggestion)
    }
  }, [onClick, suggestion])

  const file = {
    class: suggestion.class,
    type: suggestion.type,
    mime: suggestion.mime,
    name: suggestion.title.replace(/\.url$/, ''), // Not using `splitFileName()` because we don't have access to the full file here.
    parentUrl: suggestion.parentUrl
  }

  return (
    <ListItem button onClick={openSuggestion}>
      <ListItemIcon>
        {file.class === 'shortcut' ? (
          <FileIconShortcut file={file} />
        ) : (
          <FileIconMime file={file} />
        )}
      </ListItemIcon>
      <ListItemText
        primary={
          <SuggestionItemTextHighlighted text={file.name} query={query} />
        }
        secondary={
          file.parentUrl?.includes(SHARED_DRIVES_DIR_ID) ? null : (
            <SuggestionItemTextSecondary
              text={suggestion.subtitle}
              url={suggestion.parentUrl}
              query={query}
              onOpened={onParentOpened}
              isMobile={isMobile}
            />
          )
        }
      />
    </ListItem>
  )
}

export default SuggestionItem
