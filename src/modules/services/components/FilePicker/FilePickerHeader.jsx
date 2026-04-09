import get from 'lodash/get'
import uniqBy from 'lodash/uniqBy'
import PropTypes from 'prop-types'
import React, { useCallback, memo } from 'react'

import { useQuery, hasQueryBeenLoaded } from 'cozy-client'
import Icon from 'cozy-ui/transpiled/react/Icon'
import IconButton from 'cozy-ui/transpiled/react/IconButton'
import Previous from 'cozy-ui/transpiled/react/Icons/Previous'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'

import { ROOT_DIR_ID } from '.'
import FilePickerBreadcrumb from './FilePickerBreadcrumb'
import { buildCurrentFolderQuery } from './queries'

/**
 * @param {IOCozyFolder} displayedFolder - An io.cozy.files folder
 * @returns {{id: string, name: string}[]}
 */
const getBreadcrumbPath = displayedFolder => {
  return uniqBy(
    [
      {
        id: ROOT_DIR_ID
      },
      {
        id: get(displayedFolder, 'dir_id')
      },
      {
        id: displayedFolder.id,
        name: displayedFolder.name
      }
    ],
    'id'
  )
    .filter(({ id }) => Boolean(id))
    .map(breadcrumb => ({
      id: breadcrumb.id,
      name: breadcrumb.name || (breadcrumb.id === ROOT_DIR_ID ? 'Drive' : '…')
    }))
}

const FilePickerHeader = ({ navigateTo, folderId, onClose }) => {
  const { isMobile } = useBreakpoints()

  const currentFolderQuery = buildCurrentFolderQuery(folderId)
  const { data: currentFolder, ...restCurrentFolder } = useQuery(
    currentFolderQuery.definition,
    currentFolderQuery.options
  )

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const path = hasQueryBeenLoaded(restCurrentFolder)
    ? getBreadcrumbPath(currentFolder[0])
    : []

  const onBack = useCallback(path => navigateTo(path), [navigateTo])

  const handleClick = useCallback(() => {
    path.length > 1 && isMobile ? onBack(path[path.length - 2]) : onClose()
  }, [isMobile, path, onBack, onClose])

  return (
    <div className="u-flex u-flex-items-center">
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
  folderId: PropTypes.string.isRequired,
  navigateTo: PropTypes.func.isRequired
}

export default memo(FilePickerHeader)
