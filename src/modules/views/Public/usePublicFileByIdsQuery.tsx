import { useState, useEffect } from 'react'

import CozyClient, { useClient } from 'cozy-client'
import { IOCozyFile } from 'cozy-client/types/types'

type FetchStatus = 'pending' | 'loading' | 'loaded' | 'error'

interface UsePublicFileByIdsQueryReturn {
  fetchStatus: FetchStatus
  files: IOCozyFile[]
}

interface FileCollection {
  statById: (fileId: string) => Promise<{ data: IOCozyFile[] }>
}

export const fetchFileById = async (
  client: CozyClient,
  fileId: string
): Promise<IOCozyFile[]> => {
  const response = await (
    client.collection('io.cozy.files') as FileCollection
  ).statById(fileId)

  return response.data
}

export const usePublicFileByIdsQuery = (
  fileIds: string[]
): UsePublicFileByIdsQueryReturn => {
  const client = useClient()
  const [fetchStatus, setFetchStatus] = useState<FetchStatus>('pending')
  const [data, setData] = useState<IOCozyFile[]>([])

  useEffect(() => {
    if (!client) return

    const initialFetch = async (): Promise<void> => {
      try {
        setFetchStatus('loading')

        const response = await Promise.all(
          fileIds.map(fileId => fetchFileById(client, fileId))
        )

        const parsedData = response.flatMap(item => item)
        setData(parsedData)
        setFetchStatus('loaded')
      } catch (error) {
        setFetchStatus('error')
      }
    }
    void initialFetch()
  }, [client, fileIds])

  return {
    fetchStatus,
    files: data
  }
}

export default usePublicFileByIdsQuery
