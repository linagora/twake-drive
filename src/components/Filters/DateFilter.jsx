import { Calendar, Icon } from '@linagora/twake-icons'
import PropTypes from 'prop-types'
import React from 'react'

import MenuItem from 'cozy-ui/transpiled/react/MenuItem'
import { makeStyles } from 'cozy-ui/transpiled/react/styles'
import { useI18n } from 'twake-i18n'

import { Filter } from './Filter'

const DATE_RANGE_OPTIONS = [
  {
    value: 'today',
    labelKey: 'filters.date.options.today'
  },
  {
    value: 'last-7-days',
    labelKey: 'filters.date.options.last_7_days'
  },
  {
    value: 'last-month',
    labelKey: 'filters.date.options.last_month'
  },
  {
    value: 'this-year',
    labelKey: 'filters.date.options.this_year'
  }
]

const DATE_RANGE_VALUES = DATE_RANGE_OPTIONS.map(option => option.value)

const useStyles = makeStyles(() => ({
  filter: {
    minWidth: 241,
    maxWidth: 320
  },
  menu: {
    width: 210,
    minWidth: '210px !important'
  }
}))

function findDateRangeOption(value) {
  return DATE_RANGE_OPTIONS.find(option => option.value === value) ?? null
}

function DateFilter({ value = null, onChange, onClear }) {
  const classes = useStyles()
  const { t } = useI18n()
  const selectedOption = findDateRangeOption(value)
  const label = selectedOption
    ? t(selectedOption.labelKey)
    : t('filters.date.label')
  const options = DATE_RANGE_OPTIONS.map(option => ({
    ...option,
    label: t(option.labelKey)
  }))
  const mobileOptions = [
    {
      label: t('filters.date.label'),
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
      aria-label={t('filters.date.aria_label')}
      className={classes.filter}
      clearLabel={t('filters.date.clear')}
      label={label}
      menuClassName={classes.menu}
      onChange={handleChange}
      onClear={onClear}
      options={mobileOptions}
      startAdornment={<Icon icon={Calendar} size={20} />}
      value={value ?? ''}
    >
      {options.map(option => (
        <MenuItem key={option.value} value={option.value}>
          {option.label}
        </MenuItem>
      ))}
    </Filter>
  )
}

DateFilter.propTypes = {
  onChange: PropTypes.func.isRequired,
  onClear: PropTypes.func.isRequired,
  value: PropTypes.oneOf(DATE_RANGE_VALUES)
}

export { DateFilter }
