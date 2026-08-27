import { Cross, Icon } from '@linagora/twake-icons'
import React from 'react'

import { GroupAvatar, MemberAvatar } from 'cozy-sharing'
import Button from 'cozy-ui/transpiled/react/Button'
import { makeStyles } from 'cozy-ui/transpiled/react/styles'
import { useI18n } from 'twake-i18n'

import type { SharingsContactFilterOptionData } from './sharingContactFilter'
import type { UseSharingsFiltersResult } from './useSharingsFilters'

import { ContactFilter, DateFilter, FileTypeFilter } from '@/components/Filters'
import type { ContactFilterOption } from '@/components/Filters/ContactFilter'

const CONTACT_FILTER = 'contact'
const FILE_TYPE_FILTER = 'type'
const MODIFICATION_DATE_FILTER = 'date'

export interface SharingsFiltersProps extends UseSharingsFiltersResult {
  contactFilterLoading?: boolean
  contactFilterOptions?: SharingsContactFilterOptionData[]
}

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
  contactFilterLoading = false,
  contactFilterOptions = [],
  filters,
  hasActiveFilters,
  setFilter,
  supportedFilters
}: SharingsFiltersProps): JSX.Element | null {
  const classes = useStyles()
  const { t } = useI18n()
  const supportsContact = supportedFilters.includes(CONTACT_FILTER)
  const supportsFileType = supportedFilters.includes(FILE_TYPE_FILTER)
  const supportsModificationDate = supportedFilters.includes(
    MODIFICATION_DATE_FILTER
  )
  const contact = filters[CONTACT_FILTER] ?? null
  const fileType = filters[FILE_TYPE_FILTER] ?? null
  const modificationDate = filters[MODIFICATION_DATE_FILTER] ?? null
  const contactOptions: ContactFilterOption[] = contactFilterOptions.map(
    option => ({
      avatar:
        option.kind === 'person' ? (
          <MemberAvatar recipient={option.recipient} size="s" />
        ) : (
          <GroupAvatar color={option.recipient.color} size="s" />
        ),
      label: option.label,
      searchableValues: option.searchableValues,
      secondaryLabel: option.secondaryLabel,
      value: option.value
    })
  )

  if (!supportsContact && !supportsFileType && !supportsModificationDate) {
    return null
  }

  return (
    <div className={classes.root} data-testid="sharings-filters">
      {supportsFileType ? (
        <FileTypeFilter
          onChange={(value: string): void => setFilter(FILE_TYPE_FILTER, value)}
          onClear={(): void => setFilter(FILE_TYPE_FILTER, null)}
          value={fileType}
        />
      ) : null}
      {supportsContact ? (
        <ContactFilter
          loading={contactFilterLoading}
          onChange={(value: string): void => setFilter(CONTACT_FILTER, value)}
          onClear={(): void => setFilter(CONTACT_FILTER, null)}
          options={contactOptions}
          value={contact}
        />
      ) : null}
      {supportsModificationDate ? (
        <DateFilter
          onChange={(value: string): void =>
            setFilter(MODIFICATION_DATE_FILTER, value)
          }
          onClear={(): void => setFilter(MODIFICATION_DATE_FILTER, null)}
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
