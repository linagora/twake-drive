import PropTypes from 'prop-types'
import React from 'react'

import { Icon, Download } from '@linagora/twake-icons'

import { NavItem } from '@/modules/navigation/NavItem'
import { makeFoldersNavRegExp } from '@/modules/navigation/helpers'

const DownloadsNavItem = ({ folderId, highlightedFolderIds, clickState }) => {
  const path = `/folder/${folderId}`
  const highlightRegExp = makeFoldersNavRegExp(highlightedFolderIds)

  return (
    <NavItem
      to={path}
      icon={<Icon icon={Download} />}
      label="downloads"
      rx={highlightRegExp}
      clickState={clickState}
    />
  )
}

DownloadsNavItem.propTypes = {
  folderId: PropTypes.string.isRequired,
  highlightedFolderIds: PropTypes.arrayOf(PropTypes.string).isRequired,
  clickState: PropTypes.array.isRequired
}

export default DownloadsNavItem
