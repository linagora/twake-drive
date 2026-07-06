import PropTypes from 'prop-types'
import React, { useCallback, memo } from 'react'

import { useQuery, hasQueryBeenLoaded } from 'cozy-client'
import Icon from 'cozy-ui/transpiled/react/Icon'
import IconButton from 'cozy-ui/transpiled/react/IconButton'
import Previous from 'cozy-ui/transpiled/react/Icons/Previous'
import withBreakpoints from 'cozy-ui/transpiled/react/helpers/withBreakpoints'

import { ROOT_DIR_ID } from '.'
import FilePickerBreadcrumb from './FilePickerBreadcrumb'
import { buildCurrentFolderQuery } from './queries'

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

const FilePickerHeader = ({ navigateTo, folderId, onClose, breakpoints }) => {
  const isMobile = breakpoints.isMobile

  const currentFolderQuery = buildCurrentFolderQuery(folderId)
  const { data: currentFolder, ...restCurrentFolder } = useQuery(
    currentFolderQuery.definition,
    currentFolderQuery.options
  )

  const displayedFolder = Array.isArray(currentFolder)
    ? currentFolder[0]
    : currentFolder

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const path = hasQueryBeenLoaded(restCurrentFolder)
    ? getBreadcrumbPath(displayedFolder)
    : []

  const handleClick = useCallback(() => {
    path.length > 1 && isMobile ? navigateTo(path[path.length - 2]) : onClose()
  }, [isMobile, path, navigateTo, onClose])

  return (
    <div
      className="u-flex u-flex-items-center"
      data-testid="file-picker-header"
    >
      {isMobile && (
        <IconButton
          onClick={handleClick}
          className="u-p-0 u-pr-1"
          size="medium"
        >
          <Icon icon={Previous} />
        </IconButton>
      )}
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
  breakpoints: PropTypes.shape({
    isMobile: PropTypes.bool.isRequired
  }).isRequired,
  folderId: PropTypes.string.isRequired,
  navigateTo: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired
}

export default memo(withBreakpoints()(FilePickerHeader))
