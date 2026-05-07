import React, { FC } from 'react'

import { useQuery } from 'cozy-client'
import { IOCozyFile } from 'cozy-client/types/types'
import { NavDesktopDropdown } from 'cozy-ui/transpiled/react/Nav'
import { useI18n } from 'twake-i18n'

import { ExternalDriveListItem } from './ExternalDriveListItem'

import { buildExternalDrivesQuery } from '@/queries'

interface ExternalDriveListProps {
  className?: string
  clickState: [string, (value: string | undefined) => void]
}

const ExternalDrives: FC<ExternalDriveListProps> = ({
  className,
  clickState
}) => {
  const { t } = useI18n()
  const externalDrivesQuery = buildExternalDrivesQuery({
    sortAttribute: 'name',
    sortOrder: 'desc'
  })
  const externalDrivesResult = useQuery(
    externalDrivesQuery.definition,
    externalDrivesQuery.options
  ) as {
    data?: IOCozyFile[] | null
  }

  if (externalDrivesResult.data && externalDrivesResult.data.length > 0) {
    return (
      <NavDesktopDropdown
        label={t('Nav.item_external_drives')}
        className={className}
      >
        {externalDrivesResult.data.map(file => (
          <ExternalDriveListItem
            key={file._id}
            file={file}
            setLastClicked={clickState[1]}
          />
        ))}
      </NavDesktopDropdown>
    )
  }

  return null
}

export { ExternalDrives }
