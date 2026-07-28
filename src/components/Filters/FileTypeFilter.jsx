import { File, Icon } from '@linagora/twake-icons'
import PropTypes from 'prop-types'
import React from 'react'

import MenuItem from 'cozy-ui/transpiled/react/MenuItem'
import { makeStyles } from 'cozy-ui/transpiled/react/styles'
import { useI18n } from 'twake-i18n'

import { Filter } from './Filter'
import { FILE_TYPE_OPTIONS, findFileTypeOption } from './fileTypes'

import { FILE_TYPE_VALUES } from '@/lib/fileTypes'

const useStyles = makeStyles(theme => ({
  filter: {
    minWidth: 130,
    maxWidth: 320
  },
  option: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1)
  }
}))

function FileTypeFilter({ value = null, onChange, onClear }) {
  const classes = useStyles()
  const { t } = useI18n()
  const selectedOption = findFileTypeOption(value)
  const label = selectedOption
    ? t(selectedOption.labelKey)
    : t('filters.type.label')
  const options = FILE_TYPE_OPTIONS.map(option => ({
    ...option,
    label: t(option.labelKey)
  }))
  const mobileOptions = [
    {
      label: t('filters.type.label'),
      value: ''
    },
    ...options
  ]

  const handleChange = event => {
    onChange(event.target.value)
  }

  return (
    <Filter
      active={selectedOption !== null}
      autoWidth
      aria-label={t('filters.type.aria_label')}
      className={classes.filter}
      clearLabel={t('filters.type.clear')}
      label={label}
      onChange={handleChange}
      onClear={onClear}
      options={mobileOptions}
      startAdornment={<Icon icon={File} size={20} />}
      value={value ?? ''}
    >
      {options.map(option => (
        <MenuItem key={option.value} value={option.value}>
          <span className={classes.option}>
            <Icon icon={option.icon} size={16} />
            <span>{option.label}</span>
          </span>
        </MenuItem>
      ))}
    </Filter>
  )
}

FileTypeFilter.propTypes = {
  onChange: PropTypes.func.isRequired,
  onClear: PropTypes.func.isRequired,
  value: PropTypes.oneOf(FILE_TYPE_VALUES)
}

export { FileTypeFilter }
