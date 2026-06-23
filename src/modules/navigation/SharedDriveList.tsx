import React, { FC } from 'react'

import { NavDesktopDropdown } from 'cozy-ui/transpiled/react/Nav'
import { useI18n } from 'twake-i18n'

import { SharedDriveListItem } from './SharedDriveListItem'

import type { SharedDrive } from '@/modules/shareddrives/helpers'
import { useSharedDrives } from '@/modules/shareddrives/hooks/useSharedDrives'

interface SharedDriveListProps {
  clickState: [string, (value: string | undefined) => void]
}

const SharedDriveList: FC<SharedDriveListProps> = ({ clickState }) => {
  const { t } = useI18n()
  const { sharedDrives } = useSharedDrives() as {
    sharedDrives: SharedDrive[]
  }

  const orgDrives = sharedDrives.filter(
    (sharing: SharedDrive) => sharing.org_drive
  )

  if (orgDrives.length > 0) {
    return (
      <NavDesktopDropdown label={t('Nav.item_shared_drives')}>
        {orgDrives.map(sharing => (
          <SharedDriveListItem
            key={sharing._id}
            sharing={sharing}
            clickState={clickState}
          />
        ))}
      </NavDesktopDropdown>
    )
  }

  return null
}

export { SharedDriveList }
