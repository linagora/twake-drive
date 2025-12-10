import cx from 'classnames'
import React from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from 'twake-i18n'

import { isDirectory } from 'cozy-client/dist/models/file'
import Icon from 'cozy-ui/transpiled/react/Icon'
import ShareIcon from 'cozy-ui/transpiled/react/Icons/Share'
import MidEllipsis from 'cozy-ui/transpiled/react/MidEllipsis'
import { TableCell } from 'cozy-ui/transpiled/react/deprecated/Table'

import styles from '@/styles/filelist.styl'

import { useViewSwitcherContext } from '@/lib/ViewSwitcherContext'
import RenameInput from '@/modules/drive/RenameInput'
import CertificationsIcons from '@/modules/filelist/cells/CertificationsIcons'
import {
  getFileNameAndExtension,
  makeParentFolderPath
} from '@/modules/filelist/helpers'
import { isSharedDriveFolder } from '@/modules/shareddrives/helpers'

const FileName = ({
  attributes,
  isRenaming,
  interactive,
  withFilePath,
  isMobile,
  formattedSize,
  formattedUpdatedAt,
  refreshFolderContent,
  isInSyncFromSharing
}) => {
  const { t } = useI18n()
  const { viewType } = useViewSwitcherContext()
  const classes = cx(
    styles['fil-content-cell'],
    styles['fil-content-file'],
    { [styles['fil-content-file-openable']]: !isRenaming && interactive },
    { [styles['fil-content-row-disabled']]: isInSyncFromSharing },
    { [styles['fil-content-grid-view']]: viewType === 'grid' }
  )

  const { title, filename, extension } = getFileNameAndExtension(attributes, t)
  const parentFolderPath = makeParentFolderPath(attributes)

  return (
    <TableCell className={classes}>
      {isRenaming ? (
        <RenameInput
          file={attributes}
          refreshFolderContent={refreshFolderContent}
        />
      ) : (
        <div className={styles['fil-file']}>
          <div className={styles['fil-file-filename']}>
            <div className={styles['fil-file-filename-wrapper']}>
              <div
                data-testid="fil-file-filename-and-ext"
                className={styles['fil-file-filename-and-ext']}
                title={title}
              >
                {filename}
                {extension && (
                  <span className={styles['fil-content-ext']}>{extension}</span>
                )}
              </div>
            </div>
          </div>
          {withFilePath &&
            parentFolderPath &&
            (isMobile ? (
              <div
                className={styles['fil-file-description']}
                title={filename + extension}
              >
                <MidEllipsis
                  className={styles['fil-file-description--path']}
                  text={parentFolderPath}
                />
                <CertificationsIcons attributes={attributes} />
              </div>
            ) : (
              <Link
                to={`/folder/${attributes.dir_id}`}
                // Please do not modify the className as it is used in event handling, see FileOpener#46
                className={styles['fil-file-path']}
              >
                <MidEllipsis text={parentFolderPath} />
              </Link>
            ))}
          {!withFilePath &&
            (isDirectory(attributes) || (
              <div className={styles['fil-file-infos']}>
                {`${formattedUpdatedAt}${
                  formattedSize ? ` - ${formattedSize}` : ''
                }`}
                {isMobile && <CertificationsIcons attributes={attributes} />}
              </div>
            ))}
          {!withFilePath && isSharedDriveFolder(attributes) && (
            <div className={styles['fil-file-shared']}>
              <Icon
                icon={ShareIcon}
                size="10"
                className={styles['fil-file-shared-icon']}
              />
              {t('Files.share.shared')}
            </div>
          )}
        </div>
      )}
    </TableCell>
  )
}

export default FileName
