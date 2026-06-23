import React, { FC, useCallback } from 'react'
import {
  Navigate,
  useLocation,
  useParams,
  useNavigate,
  useSearchParams
} from 'react-router-dom'

import { useClient } from 'cozy-client'
import { NextcloudFile } from 'cozy-client/types/types'

interface NextcloudFilesCollection {
  deletePermanently: (file: NextcloudFile) => Promise<void>
}

import { LoaderModal } from '@/components/LoaderModal'
import { getParentPath } from '@/lib/path'
import { computeNextcloudFolderQueryId } from '@/modules/nextcloud/helpers'
import { useNextcloudEntries } from '@/modules/nextcloud/hooks/useNextcloudEntries'
import { useNextcloudPath } from '@/modules/nextcloud/hooks/useNextcloudPath'
import DestroyConfirm from '@/modules/trash/components/DestroyConfirm'

const NextcloudDestroyView: FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { sourceAccount } = useParams()
  const client = useClient()
  const path = useNextcloudPath({
    insideTrash: true
  })
  const { pathname } = useLocation()
  const { hasEntries, entries, isLoading } = useNextcloudEntries({
    insideTrash: true
  })

  const newPath = `${getParentPath(pathname) ?? ''}?${searchParams.toString()}`

  const handleClose = (): void => {
    navigate(newPath, { replace: true })
  }

  const handleConfirm = useCallback(async (): Promise<void> => {
    if (entries) {
      for (const file of entries) {
        const collection = client?.collection(
          'io.cozy.remote.nextcloud.files'
        ) as unknown as NextcloudFilesCollection
        await collection.deletePermanently(file)
      }
      const queryId =
        computeNextcloudFolderQueryId({
          sourceAccount,
          path
        }) + '/trashed'
      void client?.resetQuery(queryId)
    }
  }, [client, entries, path, sourceAccount])

  if (!hasEntries) {
    return <Navigate to={newPath} replace />
  }

  if (entries && !isLoading) {
    return (
      <DestroyConfirm
        onConfirm={handleConfirm}
        files={entries}
        onClose={handleClose}
      />
    )
  }

  return <LoaderModal />
}

export { NextcloudDestroyView }
