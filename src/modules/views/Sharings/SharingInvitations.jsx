import React, { useMemo } from 'react'
import { useLocation } from 'react-router-dom'

import { useSharingContext } from 'cozy-sharing'

import SharingInvitation from './SharingInvitation'
import { getVisibleInvitations } from './helpers'
import { useSharingsQueryResult } from './useSharingsQueryResult'

import { isSpacePath } from '@/modules/routeUtils'

const SharingInvitations = () => {
  const { byDocId, allLoaded } = useSharingContext()
  const sharedDocumentIds = useMemo(() => Object.keys(byDocId ?? {}), [byDocId])
  const { data } = useSharingsQueryResult(sharedDocumentIds, allLoaded)
  const { pathname } = useLocation()

  const invitations = getVisibleInvitations(data)

  if (invitations.length === 0 || isSpacePath(pathname)) return null

  return (
    <div data-testid="sharing-invitations">
      {invitations.map(file => (
        <SharingInvitation key={file._id} file={file} />
      ))}
    </div>
  )
}

export default SharingInvitations
