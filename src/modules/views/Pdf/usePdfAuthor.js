import { useEffect, useState } from 'react'

import { isQueryLoading, useClient, useQuery } from 'cozy-client'

import logger from '@/lib/logger'
import { buildSettingsByIdQuery } from '@/queries'

const getUrlUsername = () =>
  new URLSearchParams(window.location.search).get('username') || undefined

/**
 * Resolves the name to attribute PDF annotations and comments to.
 *
 * - Private: the instance owner's `public_name` from io.cozy.settings/instance.
 * - Public: the share recipient's `public_name`, resolved in priority from the
 *   token (the member the stack ties to the sharecode, via /permissions/self),
 *   and falling back to the `username` carried in the share URL query string.
 *   Both are absent for anonymous link shares, in which case the author stays
 *   undefined.
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

  const [publicAuthor, setPublicAuthor] = useState({
    author: undefined,
    isLoading: isPublic
  })

  useEffect(() => {
    if (!isPublic) return undefined
    let cancelled = false

    const resolve = async () => {
      let tokenName
      try {
        const permissions = await client
          .collection('io.cozy.permissions')
          .fetchOwnPermissions()
        const member = permissions.included?.[0]?.attributes
        tokenName = member?.public_name || member?.name
      } catch (error) {
        // Anonymous link shares can't read /permissions/self; fall back to URL.
        logger.warn(`Cannot resolve PDF author from token: ${error}`)
      }
      if (cancelled) return
      setPublicAuthor({
        author: tokenName || getUrlUsername(),
        isLoading: false
      })
    }

    resolve()
    return () => {
      cancelled = true
    }
  }, [client, isPublic])

  if (isPublic) return publicAuthor

  return {
    author: settingsResult.data?.public_name || undefined,
    isLoading: isQueryLoading(settingsResult)
  }
}
