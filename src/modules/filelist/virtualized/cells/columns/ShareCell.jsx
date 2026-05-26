import React from 'react'

import { useSharingContext } from 'cozy-sharing'

import { useIsInSyncFromSharing } from './useIsInSyncFromSharing'

import Share from '@/modules/filelist/virtualized/cells/Share'

const ShareCell = ({ row }) => {
  const { byDocId } = useSharingContext()
  const isInSyncFromSharing = useIsInSyncFromSharing(row)
  const isShared = byDocId[row.id] !== undefined
  if (isInSyncFromSharing || !isShared) return '—'
  return <Share row={row} isInSyncFromSharing={isInSyncFromSharing} />
}

export default ShareCell
