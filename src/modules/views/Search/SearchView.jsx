import cx from 'classnames'
import React, { useState, useCallback } from 'react'
import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useI18n } from 'twake-i18n'

import { BarLeft, BarSearch } from 'cozy-bar'
import { models, useClient } from 'cozy-client'
import { isFlagshipApp } from 'cozy-device-helper'
import { useWebviewIntent } from 'cozy-intent'
import { Main } from 'cozy-ui/transpiled/react/Layout'
import List from 'cozy-ui/transpiled/react/List'
import LoadMore from 'cozy-ui/transpiled/react/LoadMore'
import Input from 'cozy-ui/transpiled/react/legacy/Input'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'

import styles from '@/modules/search/components/styles.styl'

import BackButton from '@/components/Button/BackButton'
import BarSearchInputGroup from '@/modules/search/components/BarSearchInputGroup'
import SearchEmpty from '@/modules/search/components/SearchEmpty'
import SuggestionItem from '@/modules/search/components/SuggestionItem'
import SuggestionListSkeleton from '@/modules/search/components/SuggestionListSkeleton'
import useSearch from '@/modules/search/hooks/useSearch'

const SearchView = () => {
  const webviewIntent = useWebviewIntent()
  const { search } = useLocation()
  const navigate = useNavigate()
  const { isMobile } = useBreakpoints()
  const client = useClient()

  const [searchTerm, setSearchTerm] = useState('')
  const { t } = useI18n()
  const {
    isBusy,
    suggestions,
    hasSuggestions,
    query,
    makeIndexes,
    hasMore,
    fetchMore
  } = useSearch(searchTerm, { limit: 25 })

  useEffect(() => {
    makeIndexes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onInputChanged = event => {
    setSearchTerm(event.target.value)
  }

  const navigateBack = useCallback(() => {
    const params = new URLSearchParams(search)
    const returnPath = params.get('returnPath')
    navigate(returnPath ? returnPath : '/')
  }, [navigate, search])

  const openSuggestion = useCallback(
    async suggestion => {
      if (suggestion.openOn === 'drive') {
        navigate(suggestion.url)
      } else if (suggestion.openOn === 'notes') {
        const url = await models.note.fetchURL(client, {
          id: suggestion.url.substr(3)
        })
        if (isFlagshipApp()) {
          webviewIntent.call('openApp', url, {
            slug: 'notes'
          })
        } else {
          window.location.assign(url)
        }
      } else {
        // eslint-disable-next-line no-console
        console.error(
          `openSuggestion (${suggestion.name}) could not be executed`
        )
      }
    },
    [navigate, webviewIntent, client]
  )

  const handleCleanInput = () => {
    setSearchTerm('')
  }

  const hasNoSearchResult = searchTerm !== '' && !hasSuggestions

  return (
    <Main>
      {isMobile && (
        <BarLeft>
          <BackButton onClick={navigateBack} />
        </BarLeft>
      )}
      <BarSearch>
        <div
          className={cx(
            styles['bar-search-container'],
            isMobile ? styles['mobile'] : ''
          )}
          role="search"
        >
          <BarSearchInputGroup
            isMobile={isMobile}
            isInputNotEmpty={searchTerm !== ''}
            onClean={handleCleanInput}
          >
            <Input
              fullwidth={true}
              value={searchTerm}
              onChange={onInputChanged}
              placeholder={t('searchbar.placeholder')}
              autoFocus
            />
          </BarSearchInputGroup>
        </div>
      </BarSearch>
      {hasSuggestions && (
        <List>
          {suggestions.map(suggestion => (
            <SuggestionItem
              suggestion={suggestion}
              query={query}
              key={suggestion.id}
              onClick={openSuggestion}
              isMobile={isMobile}
            />
          ))}
        </List>
      )}
      {hasMore && (
        <div className="u-flex u-flex-justify-center">
          <LoadMore label={t('table.load_more')} fetchMore={fetchMore} />
        </div>
      )}
      {hasNoSearchResult && !isBusy && <SearchEmpty query={query} />}
      {hasNoSearchResult && isBusy && <SuggestionListSkeleton count={10} />}
    </Main>
  )
}

export default SearchView
