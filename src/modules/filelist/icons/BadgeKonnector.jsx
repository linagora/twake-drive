import PropTypes from 'prop-types'
import React from 'react'

import {
  getReferencedBy,
  isQueryLoading,
  isReferencedBy,
  useQuery
} from 'cozy-client'
import Badge from 'cozy-ui/transpiled/react/Badge'
import { makeStyles } from 'cozy-ui/transpiled/react/styles'
import AppIcon from 'cozy-ui-plus/dist/AppIcon'

import { DOCTYPE_KONNECTORS } from '@/lib/doctypes'
import { buildFileOrFolderByIdQuery } from '@/queries'

const getKonnectorSlugFromFile = file => {
  const konnector = getReferencedBy(file, DOCTYPE_KONNECTORS)[0]
  if (konnector) {
    return konnector.id.split('/')[1]
  }
  return null
}

const useStyle = makeStyles({
  badge: {
    backgroundColor: 'var(--white)',
    height: '1.5rem',
    minWidth: '1.5rem',
    borderRadius: '0.375rem',
    border: '1px solid var(--borderMainColor)'
  },
  appIcon: {
    width: '75%',
    height: '75%'
  },
  anchorOriginBottomRightCircular: {
    bottom: '10px'
  }
})

export const BadgeKonnector = ({ file, children }) => {
  const { badge, anchorOriginBottomRightCircular, appIcon } = useStyle()
  const konnectorSlug = getKonnectorSlugFromFile(file)

  // Check if the parent folder is a konnector folder, because if have no file in your account folder, its considered as a konnector folder
  const parentFolderQuery = buildFileOrFolderByIdQuery(file.dir_id)
  const { data: parentFolder, ...parentFolderQueryLeft } = useQuery(
    parentFolderQuery.definition,
    parentFolderQuery.options
  )
  const isParentQueryLoading = isQueryLoading(parentFolderQueryLeft)
  const hasKonnectorParentFolder =
    isReferencedBy(parentFolder, DOCTYPE_KONNECTORS) ||
    // To guarantee the exclusion of account folders
    (isReferencedBy(file, DOCTYPE_KONNECTORS) &&
      isReferencedBy(file, 'io.cozy.accounts.sourceAccountIdentifier'))

  const withoutKonnectorBadge =
    isParentQueryLoading ||
    hasKonnectorParentFolder ||
    !isReferencedBy(file, DOCTYPE_KONNECTORS)

  if (withoutKonnectorBadge) {
    return <>{children}</>
  }

  return (
    <Badge
      classes={{ badge, anchorOriginBottomRightCircular }}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      badgeContent={
        <AppIcon
          className={appIcon}
          type="konnector"
          app={{ slug: konnectorSlug }}
        />
      }
    >
      {children}
    </Badge>
  )
}

BadgeKonnector.propTypes = {
  file: PropTypes.object.isRequired
}
