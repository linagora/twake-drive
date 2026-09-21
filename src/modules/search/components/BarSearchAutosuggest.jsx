import cx from 'classnames'
import React, { useState } from 'react'
import Autosuggest from 'react-autosuggest'

import { models, useClient } from 'cozy-client'
import { isFlagshipApp } from 'cozy-device-helper'
import { useWebviewIntent } from 'cozy-intent'
import List from 'cozy-ui/transpiled/react/List'

import styles from '@/modules/search/components/styles.styl'

import BarSearchInputGroup from '@/modules/search/components/BarSearchInputGroup'
import SuggestionItem from '@/modules/search/components/SuggestionItem'
import SuggestionListSkeleton from '@/modules/search/components/SuggestionListSkeleton'
import useSearch from '@/modules/search/hooks/useSearch'

const BarSearchAutosuggest = ({ t }) => {
  const webviewIntent = useWebviewIntent()
  const client = useClient()

  const [input, setInput] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const { suggestions, hasSuggestions, isBusy, query, makeIndexes } =
    useSearch(searchTerm)
  const [focused, setFocused] = useState(false)

  const theme = {
    container: 'u-w-100',
    suggestionsContainer:
      styles['bar-search-autosuggest-suggestions-container'],
    suggestionsContainerOpen:
      styles['bar-search-autosuggest-suggestions-container--open'],
    suggestionsList: styles['bar-search-autosuggest-suggestions-list']
  }

  const onSuggestionsFetchRequested = ({ value }) => {
    setSearchTerm(value)
  }
  const onSuggestionsClearRequested = () => {
    setSearchTerm('')
  }

  const cleanSearch = () => {
    setInput('')
    setSearchTerm('')
  }

  const onSuggestionSelected = async (event, { suggestion }) => {
    let url = `${window.location.origin}/#${suggestion.url}`
    if (suggestion.openOn === 'notes') {
      url = await models.note.fetchURL(client, {
        id: suggestion.url.substr(3)
      })
    }

    if (url) {
      if (isFlagshipApp()) {
        webviewIntent.call('openApp', url, { slug: suggestion.openOn })
      } else {
        window.location.assign(url)
      }
    } else {
      // eslint-disable-next-line no-console
      console.error(`openSuggestion (${suggestion.name}) could not be executed`)
    }
    cleanSearch()
  }

  // We want the user to find folders in which he can then navigate into, so we return the path here
  const getSuggestionValue = suggestion => suggestion.subtitle

  const renderSuggestion = suggestion => {
    return (
      <SuggestionItem
        suggestion={suggestion}
        query={query}
        onParentOpened={cleanSearch}
      />
    )
  }

  const inputProps = {
    placeholder: t('searchbar.placeholder'),
    value: input,
    onChange: (event, { newValue }) => {
      setInput(newValue)
    },
    onFocus: () => {
      makeIndexes()
      setFocused(true)
    },
    onBlur: () => setFocused(false)
  }

  const renderInputComponent = inputProps => (
    <BarSearchInputGroup isInputNotEmpty={input !== ''} onClean={cleanSearch}>
      <input {...inputProps} />
    </BarSearchInputGroup>
  )

  const renderSuggestionsContainer = ({ containerProps, children }) => {
    return <List {...containerProps}>{children}</List>
  }

  const hasNoSearchResult = searchTerm !== '' && focused && !hasSuggestions

  return (
    <div className={styles['bar-search-container']} role="search">
      <Autosuggest
        theme={theme}
        suggestions={suggestions}
        onSuggestionsFetchRequested={onSuggestionsFetchRequested}
        onSuggestionsClearRequested={onSuggestionsClearRequested}
        onSuggestionSelected={onSuggestionSelected}
        getSuggestionValue={getSuggestionValue}
        renderSuggestion={renderSuggestion}
        renderInputComponent={renderInputComponent}
        renderSuggestionsContainer={renderSuggestionsContainer}
        inputProps={inputProps}
        focusInputOnSuggestionClick={false}
      />
      {hasNoSearchResult && !isBusy && (
        <div
          className={cx(
            styles['bar-search-autosuggest-status-container'],
            styles['--empty']
          )}
        >
          {t('searchbar.empty', { query })}
        </div>
      )}
      {hasNoSearchResult && isBusy && (
        <div className={styles['bar-search-autosuggest-status-container']}>
          <SuggestionListSkeleton />
        </div>
      )}
    </div>
  )
}

export default BarSearchAutosuggest
