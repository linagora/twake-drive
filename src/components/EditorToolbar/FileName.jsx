import cx from 'classnames'
import PropTypes from 'prop-types'
import React, { useState, useCallback } from 'react'
import { Link } from 'react-router-dom'

import MidEllipsis from 'cozy-ui/transpiled/react/MidEllipsis'
import Typography from 'cozy-ui/transpiled/react/Typography'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'
import { makeStyles } from 'cozy-ui/transpiled/react/styles'

import styles from './styles.styl'

import filelistStyles from '@/styles/filelist.styl'

import { RenameInput } from '@/modules/drive/RenameInput'
import { makeParentFolderPath } from '@/modules/filelist/helpers'

const useStyles = makeStyles(theme => ({
  name: {
    margin: '1px 0 3px 1px'
  },
  renamable: {
    '&:hover': {
      margin: '0 0 2px',
      border: `1px solid ${theme.palette.text.secondary}`,
      borderRadius: '2px',
      cursor: 'text'
    }
  }
}))

const FileName = ({ file, isPublic, isReadOnly }) => {
  const muiStyles = useStyles()
  const { isMobile } = useBreakpoints()
  const [isRenaming, setIsRenaming] = useState(false)

  const parentFolderPath = makeParentFolderPath(file)

  const onRename = useCallback(() => setIsRenaming(true), [setIsRenaming])
  const onRenameFinished = useCallback(
    () => setIsRenaming(false),
    [setIsRenaming]
  )

  return (
    <div
      className={`${styles['fileName']} u-mh-1 u-mh-half-s u-ellipsis u-flex-grow-1`}
    >
      {isRenaming ? (
        <Typography variant="h6" noWrap>
          <RenameInput
            className={styles['filename-renameInput']}
            file={file}
            withoutExtension
            refreshFolderContent={onRenameFinished}
            onAbort={onRenameFinished}
          />
        </Typography>
      ) : (
        <Typography
          className={cx(muiStyles.name, {
            [`${muiStyles.renamable}`]: !isReadOnly
          })}
          variant="h6"
          noWrap
          onClick={!isReadOnly ? onRename : undefined}
        >
          {file.name}
        </Typography>
      )}
      {parentFolderPath && !isMobile && !isPublic && (
        <Link
          data-testid="onlyoffice-filename-path"
          to={`/folder/${file.dir_id}`}
          className={filelistStyles['fil-file-path']}
        >
          <Typography variant="caption">
            <MidEllipsis text={parentFolderPath} />
          </Typography>
        </Link>
      )}
    </div>
  )
}

FileName.propTypes = {
  file: PropTypes.object.isRequired,
  isPublic: PropTypes.bool,
  isReadOnly: PropTypes.bool
}

export default React.memo(FileName)
