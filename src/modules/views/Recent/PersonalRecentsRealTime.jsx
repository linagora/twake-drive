import debounce from 'lodash/debounce'
import { useEffect } from 'react'

import { useClient } from 'cozy-client'
import { receiveMutationResult } from 'cozy-client/dist/store'

import { DOCTYPE_FILES_RECENTS } from '@/lib/doctypes'
import logger from '@/lib/logger'
import {
  buildLatestPersonalRecentsDefinition,
  buildPersonalRecentsQuery
} from '@/queries'

const recentsQuery = buildPersonalRecentsQuery()

// The stack serves at most 100 recents per page.
const MIN_LATEST_RECENTS = 10
const MAX_LATEST_RECENTS = 100

// Groups the events of a stack job writing many recents into one refresh.
const REFRESH_DELAY = 300
const REFRESH_MAX_DELAY = 1000

// Rewrites the ids of the loaded pages only, so that the cursor of the next
// page is kept.
const updateRecentsQuery = ({ client, response, updateRecents }) => {
  client.dispatch(
    receiveMutationResult(client.generateRandomId(), response, {
      updateQueries: { [recentsQuery.options.as]: updateRecents }
    })
  )
}

const omitRecents = ({ recents, recentIds }) =>
  recents.filter(recent => !recentIds.has(recent._id))

const computeLatestRecentsLimit = recentsCount =>
  Math.min(Math.max(recentsCount, MIN_LATEST_RECENTS), MAX_LATEST_RECENTS)

const removeRecents = (client, recentIds) => {
  updateRecentsQuery({
    client,
    response: { data: [] },
    updateRecents: recents => omitRecents({ recents, recentIds })
  })
}

const putLatestRecentsFirst = ({ recents, latestRecents }) => {
  const latestIds = new Set(latestRecents.map(recent => recent._id))
  const olderRecents = recents.filter(recent => !latestIds.has(recent._id))
  return [...latestRecents, ...olderRecents]
}

// Requested without the store, so that a response coming after the view left
// cannot overwrite the recents it loaded on its return.
const fetchLatestRecents = ({ client, recentsCount }) =>
  client.requestQuery(
    buildLatestPersonalRecentsDefinition(
      computeLatestRecentsLimit(recentsCount)
    )
  )

// A recent written by a stack job with an older activity is not in the latest
// page: it is left to the next pages. A recent deleted while the request is in
// flight can still be in its response.
const saveLatestRecents = ({ client, response, deletedIds }) => {
  const latestRecents = omitRecents({
    recents: response.data,
    recentIds: deletedIds
  })
  updateRecentsQuery({
    client,
    response: { ...response, data: latestRecents },
    updateRecents: recents => putLatestRecentsFirst({ recents, latestRecents })
  })
}

const callForEachRecentsHandler = ({ realtime, method, handlers }) =>
  Object.entries(handlers).forEach(([event, handler]) =>
    realtime[method](event, DOCTYPE_FILES_RECENTS, handler)
  )

// The realtime plugin throws once the client logged out, after removing every
// handler.
const unsubscribeFromRecents = ({ realtime, handlers }) => {
  try {
    callForEachRecentsHandler({ realtime, method: 'unsubscribe', handlers })
  } catch (error) {
    logger.info('Cannot unsubscribe from the personal recents', error)
  }
}

const subscribeToRecents = ({ realtime, handlers }) => {
  try {
    callForEachRecentsHandler({ realtime, method: 'subscribe', handlers })
  } catch (error) {
    logger.error('Cannot subscribe to the personal recents', error)
    unsubscribeFromRecents({ realtime, handlers })
  }
}

/**
 * Keeps the personal recents up to date with their realtime events.
 *
 * An event carries the stored row only, without its file: the generic
 * RealTimeQueries would overwrite the recent and its `file` relationship.
 *
 * @returns {null}
 */
const PersonalRecentsRealTime = () => {
  const client = useClient()

  useEffect(() => {
    const { realtime } = client.plugins
    const pendingIds = new Set()
    const deletedIds = new Set()
    let isRefreshing = false
    let isUnmounted = false

    const refreshPendingRecents = async () => {
      if (isRefreshing || pendingIds.size === 0) return
      isRefreshing = true
      const recentsCount = pendingIds.size
      pendingIds.clear()
      deletedIds.clear()
      try {
        const response = await fetchLatestRecents({ client, recentsCount })
        if (isUnmounted) return
        saveLatestRecents({ client, response, deletedIds })
      } catch (error) {
        logger.error('Cannot refresh the personal recents', error)
      }
      isRefreshing = false
      scheduleRefresh()
    }
    const scheduleRefresh = debounce(refreshPendingRecents, REFRESH_DELAY, {
      maxWait: REFRESH_MAX_DELAY
    })

    const handleChange = recent => {
      pendingIds.add(recent._id)
      scheduleRefresh()
    }
    const handleDelete = recent => {
      pendingIds.delete(recent._id)
      deletedIds.add(recent._id)
      removeRecents(client, new Set([recent._id]))
    }
    const handlers = {
      created: handleChange,
      updated: handleChange,
      deleted: handleDelete
    }

    subscribeToRecents({ realtime, handlers })

    return () => {
      isUnmounted = true
      scheduleRefresh.cancel()
      pendingIds.clear()
      unsubscribeFromRecents({ realtime, handlers })
    }
  }, [client])

  return null
}

export default PersonalRecentsRealTime
