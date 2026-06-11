import { useEffect, useState } from 'react'

import { isQueryLoading, useClient, useQuery } from 'cozy-client'

import logger from '@/lib/logger'
import { buildSettingsByIdQuery } from '@/queries'

const getUrlUsername = () =>
  new URLSearchParams(window.location.search).get('username') || undefined

// Reads the share recipient's name from the token: the member the stack ties to
// the sharecode, via /permissions/self. Anonymous link shares can't read it, so
// it falls back to the username carried in the share URL query string.
const readTokenAuthor = async client => {
  try {
    const permissions = await client
      .collection('io.cozy.permissions')
      .fetchOwnPermissions()
    const member = permissions.included?.[0]?.attributes
    const tokenName = member?.public_name || member?.name
    if (tokenName) return tokenName
  } catch (error) {
    logger.warn(`Cannot resolve PDF author from token: ${error}`)
  }
  return getUrlUsername()
}

// Resolves the public share recipient's name from the token, asynchronously.
const usePublicAuthor = (client, enabled) => {
  const [state, setState] = useState({ author: undefined, isLoading: enabled })

  useEffect(() => {
    if (!enabled) return undefined
    let cancelled = false
    const resolve = async () => {
      const author = await readTokenAuthor(client)
      if (!cancelled) setState({ author, isLoading: false })
    }
    resolve()
    return () => {
      cancelled = true
    }
  }, [client, enabled])

  return state
}

/**
 * Resolves the name to attribute PDF annotations and comments to.
 *
 * - Private: the instance owner's `public_name` from io.cozy.settings/instance.
 * - Public: the share recipient's `public_name`, resolved in priority from the
 *   token and falling back to the `username` carried in the share URL. Both are
 *   absent for anonymous link shares, in which case the author stays undefined.
 *
 * The instance settings are not readable through a public sharecode, so that
 * query is skipped in public mode.
 *
 * @param {{ isPublic?: boolean }} [options]
 * @returns {{ author: string|undefined, isLoading: boolean }}
 */
export const usePdfAuthor = ({ isPublic = false } = {}) => {
  const client = useClient()

  const settingsQuery = buildSettingsByIdQuery('io.cozy.settings.instance')
  const settingsResult = useQuery(settingsQuery.definition, {
    ...settingsQuery.options,
    enabled: !isPublic
  })

  const publicAuthor = usePublicAuthor(client, isPublic)

  if (isPublic) return publicAuthor

  return {
    author: settingsResult.data?.public_name || undefined,
    isLoading: isQueryLoading(settingsResult)
  }
}
