import React, { useMemo } from 'react'

import { Icon, ShareExternal } from '@linagora/twake-icons'
import { useQuery } from 'cozy-client'
import { isSharingShortcutNew } from 'cozy-client/dist/models/file'
import { useSharingContext } from 'cozy-sharing'

import { DEFAULT_SHARINGS_VIEW_ROUTE } from '@/constants/config'
import { NavItem } from '@/modules/navigation/NavItem'
import { useIsSharingsPath } from '@/modules/navigation/hooks/useIsSharingsPath'
import { buildSharingsQuery } from '@/queries'

const SharingsNavItem = ({ clickState }) => {
  const { byDocId, allLoaded } = useSharingContext()
  const isActive = useIsSharingsPath()
  const sharedDocuments = useMemo(
    () => [...new Set(Object.keys(byDocId ?? {}))],
    [byDocId]
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
