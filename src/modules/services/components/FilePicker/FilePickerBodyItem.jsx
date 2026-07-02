import cx from 'classnames'
import { filesize } from 'filesize'
import PropTypes from 'prop-types'
import React from 'react'

import { models } from 'cozy-client'
import Checkbox from 'cozy-ui/transpiled/react/Checkbox'
import Divider from 'cozy-ui/transpiled/react/Divider'
import Icon from 'cozy-ui/transpiled/react/Icon'
import FileTypeFolder from 'cozy-ui/transpiled/react/Icons/FileTypeFolder'
import FileTypeText from 'cozy-ui/transpiled/react/Icons/FileTypeText'
import ListItem from 'cozy-ui/transpiled/react/ListItem'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'
import Radio from 'cozy-ui/transpiled/react/Radios'
import { makeStyles } from 'cozy-ui/transpiled/react/styles'
import { useI18n } from 'twake-i18n'

import { isValidFile, isValidFolder } from './helpers'
import styles from './styles.styl'

const {
  file: { isDirectory, isFile }
} = models

const useStyles = makeStyles(() => ({
  verticalDivider: {
    height: '2rem',
    display: 'flex',
    alignSelf: 'auto',
    alignItems: 'center',
    marginLeft: '0.5rem'
  }
}))

const FilePickerBodyItem = ({
  item,
  itemTypesAccepted,
  multiple,
  handleChoiceClick,
  handleListItemClick,
  itemsIdsSelected,
  hasDivider
}) => {
  const classes = useStyles()
  const { f } = useI18n()
  const hasChoice =
    isValidFile(item, itemTypesAccepted) ||
    isValidFolder(item, itemTypesAccepted)

  const Input = multiple ? Checkbox : Radio

  const listItemSecondaryContent = isFile(item)
    ? `${f(item.updated_at, 'dd LLL yyyy')} - ${filesize(item.size, {
        base: 10
      })}`
    : null

  return (
    <>
      <ListItem
        disabled={!hasChoice && isFile(item)}
        size="small"
        button
        data-testid="list-item"
      >
        <div
          data-testid="listitem-onclick"
          className={styles['filePickerBreadcrumb-wrapper']}
          onClick={handleListItemClick(item)}
        >
          <ListItemIcon>
            <Icon
              icon={isDirectory(item) ? FileTypeFolder : FileTypeText}
              width="32"
              height="32"
            />
          </ListItemIcon>
          <ListItemText
            primary={item.name}
            secondary={listItemSecondaryContent}
          />
        </div>
        {isDirectory(item) && hasChoice && (
          <Divider
            orientation="vertical"
            flexItem
            className={classes.verticalDivider}
          />
        )}
        <div
          data-testid="choice-onclick"
          className="u-pv-half u-h-2 u-flex u-flex-items-center"
          onClick={hasChoice ? handleChoiceClick(item) : undefined}
        >
          <Input
            data-testid={multiple ? 'checkbox-btn' : 'radio-btn'}
            onChange={() => {
              // handled by onClick on the container
            }}
            checked={itemsIdsSelected.includes(item._id)}
            value={item._id}
            className={cx('u-p-0', {
              'u-o-100': hasChoice,
              'u-o-0': !hasChoice
            })}
            disabled={!hasChoice}
          />
        </div>
      </ListItem>
      {hasDivider && <Divider component="li" />}
    </>
  )
}

FilePickerBodyItem.propTypes = {
  item: PropTypes.object.isRequired,
  itemTypesAccepted: PropTypes.arrayOf(PropTypes.string).isRequired,
  multiple: PropTypes.bool,
  handleChoiceClick: PropTypes.func.isRequired,
  handleListItemClick: PropTypes.func.isRequired,
  itemsIdsSelected: PropTypes.arrayOf(PropTypes.string).isRequired,
  hasDivider: PropTypes.bool.isRequired
}

export default FilePickerBodyItem
