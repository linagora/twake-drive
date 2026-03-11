import { useState, useEffect } from 'react'

import { useClient, useQuery } from 'cozy-client'

import { DEFAULT_SORT } from '@/config/sort'
import { SHARED_DRIVES_DIR_ID } from '@/constants/config'
import { isSharedDrive } from '@/modules/shareddrives/helpers'
import { buildDriveQuery } from '@/queries'

export const useSharedDrives = () => {
  const client = useClient()
  const [isLoading, setIsLoading] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [sharedDrives, setSharedDrives] = useState([])

  const folderQuery = buildDriveQuery({
    currentFolderId: SHARED_DRIVES_DIR_ID,
    type: 'directory',
    sortAttribute: DEFAULT_SORT.attribute,
    sortOrder: DEFAULT_SORT.order
  })

  const { data: sharedDrivesDir, lastUpdate } = useQuery(
    folderQuery.definition,
    folderQuery.options
  )

  const sharedDrivesDirId = sharedDrivesDir && sharedDrivesDir[0]._id

  useEffect(() => {
    let isCancelled = false

    const fetchSharedDrives = async () => {
      setIsLoading(true)
      try {
        const { data: sharedDrives } = await client
          .collection('io.cozy.sharings')
          .fetchSharedDrives()

        if (!isCancelled) {
          const filteredSharedDrives = sharedDrives.filter(sharedDrive =>
            isSharedDrive(sharedDrive, sharedDrivesDirId)
          )

          setSharedDrives(filteredSharedDrives)
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
          setIsLoaded(true)
        }
      }
    }

    void fetchSharedDrives()

    return () => {
      isCancelled = true
    }
  }, [client, sharedDrivesDirId, lastUpdate])

  return { isLoading, isLoaded, sharedDrives }
}
