import { Cross, Icon } from '@linagora/twake-icons'
import React from 'react'

import Button from 'cozy-ui/transpiled/react/Button'
import { makeStyles } from 'cozy-ui/transpiled/react/styles'
import { useI18n } from 'twake-i18n'

import type { UseSharingsFiltersResult } from './useSharingsFilters'

import { DateFilter, FileTypeFilter } from '@/components/Filters'

const FILE_TYPE_FILTER = 'type'
const MODIFICATION_DATE_FILTER = 'date'

const useStyles = makeStyles(theme => ({
  root: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    margin: theme.spacing(1, 2),
    [theme.breakpoints.down('sm')]: {
      margin: theme.spacing(1)
    }
  },
  clearAll: {
    color: 'var(--primaryColor)'
  }
}))

function SharingsFilters({
  clearAllFilters,
  filters,
  hasActiveFilters,
  setFilter,
  supportedFilters
}: UseSharingsFiltersResult): JSX.Element | null {
  const classes = useStyles()
  const { t } = useI18n()
  const supportsFileType = supportedFilters.includes(FILE_TYPE_FILTER)
  const supportsModificationDate = supportedFilters.includes(
    MODIFICATION_DATE_FILTER
  )
  const fileType = filters[FILE_TYPE_FILTER] ?? null
  const modificationDate = filters[MODIFICATION_DATE_FILTER] ?? null

  if (!supportsFileType && !supportsModificationDate) return null

  const handleFileTypeChange = (value: string): void => {
    setFilter(FILE_TYPE_FILTER, value)
  }
  const handleFileTypeClear = (): void => {
    setFilter(FILE_TYPE_FILTER, null)
  }
  const handleModificationDateChange = (value: string): void => {
    setFilter(MODIFICATION_DATE_FILTER, value)
  }
  const handleModificationDateClear = (): void => {
    setFilter(MODIFICATION_DATE_FILTER, null)
  }

  return (
    <div className={classes.root} data-testid="sharings-filters">
      {supportsFileType ? (
        <FileTypeFilter
          onChange={handleFileTypeChange}
          onClear={handleFileTypeClear}
          value={fileType}
        />
      ) : null}
      {supportsModificationDate ? (
        <DateFilter
          onChange={handleModificationDateChange}
          onClear={handleModificationDateClear}
          value={modificationDate}
        />
      ) : null}
      {hasActiveFilters ? (
        <Button
          className={classes.clearAll}
          onClick={clearAllFilters}
          size="small"
          startIcon={<Icon icon={Cross} size={16} />}
          variant="text"
        >
          {t('filters.clear_all')}
        </Button>
      ) : null}
    </div>
  )
}

export { SharingsFilters }
