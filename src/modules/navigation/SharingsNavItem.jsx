import { Icon, ShareExternal } from '@linagora/twake-icons'
import React, { useCallback, useMemo } from 'react'

import { useQuery } from 'cozy-client'
import { isSharingShortcutNew } from 'cozy-client/dist/models/file'
import { useSharingContext } from 'cozy-sharing'

import { DEFAULT_SHARINGS_VIEW_ROUTE } from '@/constants/config'
import { NavItem } from '@/modules/navigation/NavItem'
import { useSharedDrives } from '@/modules/shareddrives/hooks/useSharedDrives'
import { buildSharingsQuery } from '@/queries'

const SharingsNavItem = ({ clickState }) => {
  const { byDocId, allLoaded } = useSharingContext()
  const { sharedDrives } = useSharedDrives()
  const sharedDocuments = useMemo(
    () => [...new Set(Object.keys(byDocId ?? {}))],
    [byDocId]
  )

  const orgDriveIds = useMemo(
    () =>
      new Set(
        (sharedDrives || [])
          .filter(drive => drive.org_drive)
          .map(drive => drive._id)
      ),
    [sharedDrives]
  )

  const sharingQuery = useMemo(
    () =>
      buildSharingsQuery({
        ids: sharedDocuments,
        enabled: allLoaded && sharedDocuments.length > 0
      }),
    [sharedDocuments, allLoaded]
  )
  const sharingResult = useQuery(sharingQuery.definition, sharingQuery.options)

  const isActive = useCallback(
    pathname => {
      // For sharing tab
      if (pathname === '/sharings') return true
      // For shared folder but not shared drive
      if (pathname.startsWith('/shareddrive/')) {
        const driveId = pathname.split('/')[2]
        return !orgDriveIds.has(driveId)
      }
      return false
    },
    [orgDriveIds]
  )

  return (
    <NavItem
      to={DEFAULT_SHARINGS_VIEW_ROUTE}
      icon={<Icon icon={ShareExternal} />}
      label="sharings"
      isActive={isActive}
      clickState={clickState}
      badgeContent={
        sharingResult.data?.filter(isSharingShortcutNew).length ?? 0
      }
    />
  )
}

export { SharingsNavItem }
