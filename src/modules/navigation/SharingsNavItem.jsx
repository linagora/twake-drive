import React from 'react'

import { useQuery } from 'cozy-client'
import Icon from 'cozy-ui/transpiled/react/Icon'
import ShareIcon from 'cozy-ui/transpiled/react/Icons/ShareExternal'

import { NavItem } from '@/modules/navigation/NavItem'
import { buildNewSharingShortcutQuery } from '@/queries'

const SharingsNavItem = ({ clickState }) => {
  const newSharingShortcutQuery = buildNewSharingShortcutQuery()
  const newSharingShortcutResult = useQuery(
    newSharingShortcutQuery.definition,
    newSharingShortcutQuery.options
  )

  return (
    <NavItem
      to="/sharings"
      icon={<Icon icon={ShareIcon} />}
      label="sharings"
      rx={/\/sharings(\/.*)?|\/shareddrive(\/.*)?/}
      clickState={clickState}
      badgeContent={newSharingShortcutResult.data?.length}
    />
  )
}

export { SharingsNavItem }
