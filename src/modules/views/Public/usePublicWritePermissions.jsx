import { useState, useEffect } from 'react'

import { useClient, models } from 'cozy-client'

import { DOCTYPE_APPS } from '@/lib/doctypes'

export const usePublicWritePermissions = currentFolderId => {
  const client = useClient()
  const [fetchStatus, setFetchStatus] = useState('pending')
  const [hasWritePermissions, setHasWritePermissions] = useState(false)

  useEffect(() => {
    const fetch = async () => {
      try {
        setFetchStatus('loading')
        const permissions = await models.permission.fetchOwn(client)
        // The link may also read some apps, which says nothing about its rights.
        const filesRule = permissions.find(rule => rule.type !== DOCTYPE_APPS)
        setHasWritePermissions(!models.permission.isReadOnly(filesRule))
        setFetchStatus('loaded')
      } catch (_error) {
        setFetchStatus('error')
      }
    }
    fetch()
  }, [client, currentFolderId])

  return { fetchStatus, hasWritePermissions }
}

export default usePublicWritePermissions
