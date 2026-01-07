import get from 'lodash/get'
import { useState, useEffect, useRef } from 'react'

import { useClient } from 'cozy-client'

const statById = async (client, folderId, cursorToUse) => {
  // Most stack routes are off-limit when we have a read-only token, so we use a simple GET to load the folder content.
  // no query because we need to paginate the included files
  const { included, links } = await client
    .collection('io.cozy.files')
    .statById(folderId, {
      'page[cursor]': cursorToUse
    })

  const nextRelativeLink = get(links, 'next', '')
  const dummyURL = 'http://example.com' // we're only interested in the query string, the base url doesn't matter
  const nextAbsoluteLinkURL = new URL(`${dummyURL}${nextRelativeLink}`)
  const cursor = nextAbsoluteLinkURL.searchParams.get('page[cursor]')

  return { included, cursor }
}

export const usePublicFilesQuery = currentFolderId => {
  const client = useClient()
  const [fetchStatus, setFetchStatus] = useState('pending')
  const [data, setData] = useState([])
  const [hasMore, setHasMore] = useState(false)

  const [fetchCounter, updateFetchCounter] = useState(1)
  const forceRefetch = () => updateFetchCounter(prev => prev + 1)

  const nextCursor = useRef(null)

  useEffect(() => {
    const initialFetch = async () => {
      try {
        setFetchStatus('loading')
        const { included, cursor } = await statById(client, currentFolderId)
        nextCursor.current = cursor
        setData(included || [])
        setHasMore(!!cursor)
        setFetchStatus('loaded')
      } catch (error) {
        setFetchStatus('error')
      }
    }
    initialFetch()
  }, [currentFolderId, fetchCounter, client])

  const fetchMore = async () => {
    try {
      const { included, cursor } = await statById(
        client,
        currentFolderId,
        nextCursor.current
      )
      nextCursor.current = cursor
      setData([...data, ...included])
      setHasMore(!!cursor)
      setFetchStatus('loaded')
    } catch (error) {
      setFetchStatus('error')
    }
  }

  return {
    fetchStatus,
    data,
    forceRefetch,
    hasMore,
    fetchMore
  }
}

export default usePublicFilesQuery
