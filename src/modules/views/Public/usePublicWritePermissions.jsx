import { useState, useEffect } from 'react'

import { useClient, models } from 'cozy-client'

export const usePublicWritePermissions = currentFolderId => {
  const client = useClient()
  const [fetchStatus, setFetchStatus] = useState('pending')
  const [hasWritePermissions, setHasWritePermissions] = useState(false)

  useEffect(() => {
    const fetch = async () => {
      try {
        setFetchStatus('loading')
        const permissions = await models.permission.fetchOwn(client)
        setHasWritePermissions(!models.permission.isReadOnly(permissions[0]))
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
