import { useState, useEffect, useMemo } from 'react'

import { useClient } from 'cozy-client'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'

import useDebounce from '@/hooks/useDebounce'
import {
  indexFiles,
  isStackSearchUnavailable,
  searchFilesOnStack
} from '@/modules/search/components/helpers'
import { isOfficeEnabled } from '@/modules/views/OnlyOffice/helpers'

const toSuggestion = result => ({
  id: result.id,
  title: result.name,
  subtitle: result.path,
  url: result.url,
  parentUrl: result.parentUrl,
  openOn: result.openOn,
  type: result.type,
  mime: result.mime,
  class: result.class
})

/**
 * Searches the files with the stack, or with a local index of all the files
 * when the stack cannot search.
 */
const useSearch = (searchTerm, { limit = 10 } = {}) => {
  const client = useClient()
  const { isDesktop } = useBreakpoints()
  const officeEnabled = isOfficeEnabled(isDesktop)
  const [allSuggestions, setAllSuggestions] = useState([])
  const [suggestions, setSuggestions] = useState([])
  const [stackCursor, setStackCursor] = useState(null)
  const [fuzzy, setFuzzy] = useState(null)
  const [isBusy, setBusy] = useState(true)
  const [query, setQuery] = useState('')

  const debouncedSearchTerm = useDebounce(searchTerm, {
    delay: 500,
    ignore: searchTerm === ''
  })

  // The local index downloads all the files: it is only built when the stack
  // cannot search
  const makeIndexes = async () => {
    if (isStackSearchUnavailable() && fuzzy?.officeEnabled !== officeEnabled) {
      const index = await indexFiles(client, officeEnabled)
      setFuzzy({ index, officeEnabled })
    }
  }

  useEffect(() => {
    const searchLocally = async value => {
      let currentFuzzy =
        fuzzy?.officeEnabled === officeEnabled ? fuzzy.index : null
      if (currentFuzzy == null) {
        currentFuzzy = await indexFiles(client, officeEnabled)
        setFuzzy({ index: currentFuzzy, officeEnabled })
      }
      return currentFuzzy.search(value).map(toSuggestion)
    }

    const fetchSuggestions = async value => {
      setBusy(true)
      let page
      try {
        page = await searchFilesOnStack(client, value, {
          limit,
          officeEnabled
        })
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('The search failed', err)
        page = { files: [], cursor: null }
      }

      setQuery(value)
      if (page) {
        setAllSuggestions([])
        setStackCursor(page.cursor)
        setSuggestions(page.files.map(toSuggestion))
      } else {
        const results = await searchLocally(value)
        setStackCursor(null)
        setAllSuggestions(results)
        setSuggestions(results.slice(0, limit))
      }
      setBusy(value === '') // To prevent empty state to appear at the first search
    }

    if (debouncedSearchTerm !== '') {
      fetchSuggestions(debouncedSearchTerm)
    } else {
      // eslint-disable-next-line react-hooks/immutability
      clearSuggestions()
    }
  }, [client, debouncedSearchTerm, fuzzy, limit, officeEnabled])

  const hasSuggestions = useMemo(() => suggestions.length > 0, [suggestions])

  const hasMore = useMemo(
    () => !!stackCursor || suggestions.length < allSuggestions.length,
    [stackCursor, suggestions, allSuggestions]
  )

  const fetchMore = async () => {
    if (!stackCursor) {
      setSuggestions(allSuggestions.slice(0, suggestions.length + limit))
      return
    }
    try {
      const page = await searchFilesOnStack(client, query, {
        limit,
        cursor: stackCursor,
        officeEnabled
      })
      if (page) {
        setStackCursor(page.cursor)
        setSuggestions([...suggestions, ...page.files.map(toSuggestion)])
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('The search failed', err)
    }
  }

  const clearSuggestions = () => {
    setBusy(true)
    setQuery('')
    setStackCursor(null)
    setAllSuggestions([])
    setSuggestions([])
  }

  return {
    suggestions,
    hasSuggestions,
    hasMore,
    isBusy,
    query,
    makeIndexes,
    fetchMore
  }
}

export default useSearch
