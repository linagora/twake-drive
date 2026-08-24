import type { ContactFilterOption } from './ContactFilter.types'

import { normalizeSearchText } from '@/lib/normalizeSearchText'

const CONTACT_FILTER_MAX_RESULTS = 20

function filterContactFilterOptions(
  options: ContactFilterOption[],
  inputValue: string
): ContactFilterOption[] {
  const normalizedInputValue = normalizeSearchText(inputValue).trim()

  if (normalizedInputValue === '') {
    return options.slice(0, CONTACT_FILTER_MAX_RESULTS)
  }

  return options
    .filter(option => {
      const searchableValues = [
        option.label,
        option.secondaryLabel,
        ...(option.searchableValues ?? [])
      ].filter((searchableValue): searchableValue is string => {
        return searchableValue !== undefined
      })

      return searchableValues.some(value =>
        normalizeSearchText(value).includes(normalizedInputValue)
      )
    })
    .slice(0, CONTACT_FILTER_MAX_RESULTS)
}

export { filterContactFilterOptions }
