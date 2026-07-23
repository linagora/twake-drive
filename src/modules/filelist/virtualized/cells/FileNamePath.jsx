import React from 'react'
import { Link, useLocation } from 'react-router-dom'

import MidEllipsis from 'cozy-ui/transpiled/react/MidEllipsis'
import { useBreakpoints } from 'cozy-ui/transpiled/react/providers/Breakpoints'
import { useI18n } from 'twake-i18n'

import styles from '@/styles/filelist.styl'

import { getFileNameAndExtension } from '@/modules/filelist/helpers'
import { getFolderPath } from '@/modules/routeUtils'
import { getSharingsRootRoute } from '@/modules/views/Sharings/routes'

const FileNamePath = ({
  attributes,
  withFilePath,
  formattedSize,
  formattedUpdatedAt,
  parentFolderPath
}) => {
  const { isMobile } = useBreakpoints()
  const { t } = useI18n()
  const { pathname } = useLocation()
  const { filename, extension } = getFileNameAndExtension(attributes, t)

  if (!withFilePath) {
    return (
      <div className={styles['fil-file-infos']}>
        {`${formattedUpdatedAt}${formattedSize ? ` - ${formattedSize}` : ''}`}
      </div>
    )
  }

  if (isMobile) {
    return (
      <div
        className={styles['fil-file-description']}
        title={filename + extension}
      >
        <MidEllipsis
          className={styles['fil-file-description--path']}
          text={parentFolderPath}
        />
      </div>
    )
  }
  const to = attributes.driveId
    ? getSharingsRootRoute(pathname)
    : getFolderPath(attributes.dir_id)

  return (
    <Link
      to={to}
      // Please do not modify the className as it is used in event handling, see FileOpener
      className={styles['fil-file-path']}
    >
      <MidEllipsis text={parentFolderPath} />
    </Link>
  )
}

export default FileNamePath
