import { useCallback } from 'react'

import type { IOCozyFile } from 'cozy-client/types/types'
import { useSharingContext } from 'cozy-sharing'

import {
  getSharingsLastUpdatedAt,
  type SharingsTimestampContext
} from './getSharingsLastUpdatedAt'

import type { GetFileLastUpdatedAt } from '@/modules/filelist/FileLastUpdatedContext'

export function useSharingsLastUpdatedAt(): GetFileLastUpdatedAt {
  const {
    byDocId,
    getDocumentPermissions,
    getSharingById
  }: SharingsTimestampContext = useSharingContext()

  return useCallback(
    (file: IOCozyFile): string | null =>
      getSharingsLastUpdatedAt(file, {
        byDocId,
        getDocumentPermissions,
        getSharingById
      }),
    [byDocId, getDocumentPermissions, getSharingById]
  )
}
