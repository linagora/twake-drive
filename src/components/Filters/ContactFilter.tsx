import { Account, Bottom, Icon } from '@linagora/twake-icons'
import React, { useState, type FormEvent, type ReactElement } from 'react'
import Autosuggest from 'react-autosuggest'

import ActionsMenuWrapper from 'cozy-ui/transpiled/react/ActionsMenu/ActionsMenuWrapper'
import InputAdornment from 'cozy-ui/transpiled/react/InputAdornment'
import { useI18n } from 'twake-i18n'

import styles from './ContactFilter.styl'
import type {
  ContactFilterOption,
  ContactFilterProps
} from './ContactFilter.types'
import { ContactFilterMenuSurface } from './ContactFilterMenuSurface'
import { ContactFilterSearchInput } from './ContactFilterSearchInput'
import { ContactFilterSuggestion } from './ContactFilterSuggestion'
import { ContactFilterSuggestionsContainer } from './ContactFilterSuggestionsContainer'
import { Filter } from './Filter'
import { filterContactFilterOptions } from './contactFilterOptions'

let contactFilterMenuId = 0

const makeContactFilterMenuId = (): string => {
  contactFilterMenuId += 1
  return `contact-filter-menu-${contactFilterMenuId}`
}

const ContactFilter = ({
  disabled = false,
  loading = false,
  onChange,
  onClear,
  options,
  value = null
}: ContactFilterProps): ReactElement => {
  const { t } = useI18n()
  const [anchorElement, setAnchorElement] = useState<HTMLElement | null>(null)
  const [isOpen, setIsOpen] = useState<boolean>(false)
  const [inputValue, setInputValue] = useState<string>('')
  const [menuId] = useState<string>(makeContactFilterMenuId)
  const selectedOption = options.find(option => option.value === value) ?? null
  const label = selectedOption?.label ?? t('filters.contact.label')
  const suggestions = loading
    ? []
    : filterContactFilterOptions(options, inputValue)

  const handleClose = (): void => {
    setIsOpen(false)
    setInputValue('')
  }

  const handleSelect = (option: ContactFilterOption): void => {
    onChange(option.value)
    handleClose()
  }

  const handleClear = (): void => {
    onClear()
    handleClose()
  }

  const renderSuggestion = (option: ContactFilterOption): ReactElement => {
    return (
      <ContactFilterSuggestion
        currentUserLabel={t('filters.contact.me')}
        option={option}
      />
    )
  }

  const renderSuggestionsContainer = (
    params: Autosuggest.RenderSuggestionsContainerParams
  ): ReactElement => {
    return (
      <ContactFilterSuggestionsContainer
        {...params}
        emptyMessage={t('search.empty.title')}
        loading={loading}
        loadingMessage={t('loading.message')}
      />
    )
  }

  return (
    <>
      <Filter
        ref={setAnchorElement}
        active={selectedOption !== null}
        autoWidth
        className={styles.filter}
        clearLabel={t('filters.contact.clear')}
        disabled={disabled}
        inputProps={{
          'aria-controls': isOpen ? menuId : null,
          'aria-expanded': isOpen,
          'aria-haspopup': 'listbox'
        }}
        label={label}
        onClear={handleClear}
        onClick={
          disabled
            ? null
            : (): void => {
                setIsOpen(true)
              }
        }
        select={false}
        type="button"
        value={label}
        InputProps={{
          classes: {
            root: 'u-pv-0 u-pr-half u-pl-1',
            input: 'u-p-0'
          },
          startAdornment: (
            <InputAdornment position="start">
              <Icon icon={Account} size={16} />
            </InputAdornment>
          ),
          endAdornment: (
            <InputAdornment position="end">
              <Icon
                className={`${styles.triggerIcon} u-flex-shrink-0`}
                icon={Bottom}
                rotate={isOpen ? 180 : 0}
                size={16}
              />
            </InputAdornment>
          )
        }}
      />

      <ActionsMenuWrapper
        anchorEl={anchorElement}
        getContentAnchorEl={null}
        onClose={handleClose}
        open={isOpen && !disabled}
      >
        <ContactFilterMenuSurface
          className={`${styles.menu} u-bxz u-p-half`}
          id={menuId}
        >
          <Autosuggest<ContactFilterOption, never>
            alwaysRenderSuggestions
            focusInputOnSuggestionClick={false}
            getSuggestionValue={(option: ContactFilterOption): string =>
              option.label
            }
            highlightFirstSuggestion
            id={menuId}
            inputProps={{
              autoFocus: true,
              'aria-label': t('search.action'),
              onChange: (
                _event: FormEvent<HTMLElement>,
                { newValue }: Autosuggest.ChangeEvent
              ): void => {
                setInputValue(newValue)
              },
              placeholder: t('search.action'),
              type: 'search',
              value: inputValue
            }}
            onSuggestionSelected={(
              _event: FormEvent<HTMLElement>,
              {
                suggestion
              }: Autosuggest.SuggestionSelectedEventData<ContactFilterOption>
            ): void => {
              handleSelect(suggestion)
            }}
            onSuggestionsFetchRequested={() => {}}
            renderInputComponent={ContactFilterSearchInput}
            renderSuggestion={renderSuggestion}
            renderSuggestionsContainer={renderSuggestionsContainer}
            suggestions={suggestions}
            theme={{
              container: 'u-w-100',
              suggestion: 'u-bdrs-4',
              suggestionHighlighted: styles.suggestionHighlighted,
              suggestionsContainer: 'u-mt-half',
              suggestionsList: `${styles.suggestionsList} u-m-0 u-p-0`
            }}
          />
        </ContactFilterMenuSurface>
      </ActionsMenuWrapper>
    </>
  )
}

export { ContactFilter }
export type {
  ContactFilterOption,
  ContactFilterProps
} from './ContactFilter.types'
