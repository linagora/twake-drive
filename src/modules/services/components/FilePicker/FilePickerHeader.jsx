import PropTypes from 'prop-types'
import React, { memo } from 'react'

import { ROOT_DIR_ID } from '.'
import FilePickerBreadcrumb from './FilePickerBreadcrumb'
import { useCurrentFolder } from './useCurrentFolder'

/**
 * @param {IOCozyFolder} displayedFolder - An io.cozy.files folder
 * @returns {{id: string, name: string}[]}
 */
const getBreadcrumbPath = displayedFolder => {
  if (!displayedFolder) {
    return [{ id: ROOT_DIR_ID, name: 'Drive' }]
  }

  const entries = [
    { id: ROOT_DIR_ID, name: 'Drive' },
    displayedFolder.dir_id ? { id: displayedFolder.dir_id } : null,
    { id: displayedFolder._id, name: displayedFolder.name }
  ]

  const seen = new Set()
  return entries
    .filter(
      entry => entry && entry.id && !seen.has(entry.id) && seen.add(entry.id)
    )
    .map(entry => ({
      id: entry.id,
      name: entry.name || (entry.id === ROOT_DIR_ID ? 'Drive' : '…')
    }))
}

const FilePickerHeader = ({ navigateTo, folderId }) => {
  const { displayedFolder, hasLoaded } = useCurrentFolder(folderId)

  const path = hasLoaded ? getBreadcrumbPath(displayedFolder) : []

  return (
    <div
      className="u-flex u-flex-items-center"
      data-testid="file-picker-header"
    >
      <FilePickerBreadcrumb
        path={path}
        onBreadcrumbClick={navigateTo}
        opening={false}
        inlined
      />
    </div>
  )
}

FilePickerHeader.propTypes = {
  folderId: PropTypes.string.isRequired,
  navigateTo: PropTypes.func.isRequired
}

export default memo(FilePickerHeader)
