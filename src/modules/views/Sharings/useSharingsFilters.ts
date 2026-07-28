import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

import type {
  SharingsFilterValues,
  SharingsFilterValue
} from './matchSharingsFilters'
import type { SharingsTab } from './useSharingsTab'

import {
  SHARING_TAB_BY_ME,
  SHARING_TAB_DRIVES,
  SHARING_TAB_WITH_ME
} from '@/constants/config'

export interface UseSharingsFiltersResult {
  clearAllFilters: () => void
  filters: SharingsFilterValues
  hasActiveFilters: boolean
  setFilter: (filterName: string, value: SharingsFilterValue) => void
  supportedFilters: readonly string[]
}

const SHARINGS_FILTER_PREFIX = 'f.'
const FILE_TYPE_FILTER = 'type'
const MODIFICATION_DATE_FILTER = 'date'
const SHARINGS_FILTERS: readonly string[] = [
  FILE_TYPE_FILTER,
  MODIFICATION_DATE_FILTER
]
const SHARINGS_FILTERS_BY_TAB: Record<SharingsTab, readonly string[]> = {
  [SHARING_TAB_WITH_ME]: SHARINGS_FILTERS,
  [SHARING_TAB_BY_ME]: SHARINGS_FILTERS,
  [SHARING_TAB_DRIVES]: SHARINGS_FILTERS
}

function getSupportedFilters(tab: SharingsTab): readonly string[] {
  return SHARINGS_FILTERS_BY_TAB[tab]
}

function getFilterParam(filterName: string): string {
  return `${SHARINGS_FILTER_PREFIX}${filterName}`
}

export function useSharingsFilters(tab: SharingsTab): UseSharingsFiltersResult {
  const [searchParams, setSearchParams] = useSearchParams()
  const supportedFilters = getSupportedFilters(tab)
  const filters: SharingsFilterValues = Object.fromEntries(
    supportedFilters.map(filterName => [
      filterName,
      searchParams.get(getFilterParam(filterName)) || null
    ])
  )
  const hasActiveFilters = Object.values(filters).some(value => value !== null)

  const setFilter = useCallback(
    (filterName: string, value: SharingsFilterValue): void => {
      const nextSearchParams = new URLSearchParams(searchParams)
      const filterParam = getFilterParam(filterName)

      if (supportedFilters.includes(filterName) && value) {
        nextSearchParams.set(filterParam, value)
      } else {
        nextSearchParams.delete(filterParam)
      }

      setSearchParams(nextSearchParams, { replace: true })
    },
    [searchParams, setSearchParams, supportedFilters]
  )

  const clearAllFilters = useCallback((): void => {
    setSearchParams(new URLSearchParams(), { replace: true })
  }, [setSearchParams])

  return {
    clearAllFilters,
    filters,
    hasActiveFilters,
    setFilter,
    supportedFilters
  }
}
