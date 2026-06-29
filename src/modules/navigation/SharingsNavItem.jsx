import React, { useMemo } from 'react'

import { useQuery } from 'cozy-client'
import { isSharingShortcutNew } from 'cozy-client/dist/models/file'
import { useSharingContext } from 'cozy-sharing'
import Icon from 'cozy-ui/transpiled/react/Icon'
import ShareIcon from 'cozy-ui/transpiled/react/Icons/ShareExternal'

import { NavItem } from '@/modules/navigation/NavItem'
import { buildSharingsQuery } from '@/queries'

const SharingsNavItem = ({ clickState }) => {
  const { byDocId, allLoaded } = useSharingContext()
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
      to="/sharings"
      icon={<Icon icon={ShareIcon} />}
      label="sharings"
      rx={/\/sharings(\/.*)?|\/shareddrive(\/.*)?/}
      clickState={clickState}
      badgeContent={
        sharingResult.data?.filter(isSharingShortcutNew).length ?? 0
      }
    />
  )
}

export { SharingsNavItem }
