import { Icon, Download, File, Trash } from '@linagora/twake-icons'
import PropTypes from 'prop-types'
import React from 'react'

import IconButton from 'cozy-ui/transpiled/react/IconButton'
import ListItem from 'cozy-ui/transpiled/react/ListItem'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemSecondaryAction from 'cozy-ui/transpiled/react/ListItemSecondaryAction'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'
import { useI18n } from 'twake-i18n'

/**
 * One entry of a file's version list.
 *
 * cozy-ui's HistoryRow renders a single hardcoded download action and exposes
 * no slot for a second one, hence this local row built on the standard list
 * primitives.
 */
export const HistoryRow = ({
  tag,
  primaryText,
  secondaryText,
  onDownload,
  onDelete
}) => {
  const { t } = useI18n()

  return (
    <ListItem>
      <ListItemIcon>
        <Icon icon={File} color="var(--secondaryTextColor)" />
      </ListItemIcon>
      <ListItemText
        primary={primaryText}
        secondary={[tag, secondaryText].filter(Boolean).join(' · ')}
      />
      <ListItemSecondaryAction>
        <IconButton
          aria-label={t('History.download')}
          data-testid="history-row-download"
          onClick={onDownload}
        >
          <Icon icon={Download} color="var(--secondaryTextColor)" />
        </IconButton>
        {onDelete && (
          <IconButton
            aria-label={t('History.deleteVersion.action')}
            data-testid="history-row-delete"
            onClick={onDelete}
          >
            <Icon icon={Trash} color="var(--secondaryTextColor)" />
          </IconButton>
        )}
      </ListItemSecondaryAction>
    </ListItem>
  )
}

HistoryRow.propTypes = {
  /** Label marking this row as the file's current version */
  tag: PropTypes.string,
  primaryText: PropTypes.string,
  secondaryText: PropTypes.string,
  onDownload: PropTypes.func.isRequired,
  /** When omitted, the row offers no delete action */
  onDelete: PropTypes.func
}
