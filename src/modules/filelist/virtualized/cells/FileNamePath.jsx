import React from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from 'twake-i18n'

import MidEllipsis from 'cozy-ui/transpiled/react/MidEllipsis'
import { useBreakpoints } from 'cozy-ui/transpiled/react/providers/Breakpoints'

import styles from '@/styles/filelist.styl'

import { SHARINGS_VIEW_ROUTE } from '@/constants/config'
import CertificationsIcons from '@/modules/filelist/cells/CertificationsIcons.jsx'
import { getFileNameAndExtension } from '@/modules/filelist/helpers'
import { getFolderPath } from '@/modules/routeUtils'

const FileNamePath = ({
  attributes,
  withFilePath,
  formattedSize,
  formattedUpdatedAt,
  parentFolderPath
}) => {
  const { isMobile } = useBreakpoints()
  const { t } = useI18n()
  const { filename, extension } = getFileNameAndExtension(attributes, t)

  if (!withFilePath) {
    return (
      <div className={styles['fil-file-infos']}>
        {`${formattedUpdatedAt}${formattedSize ? ` - ${formattedSize}` : ''}`}
        <CertificationsIcons attributes={attributes} />
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
        <CertificationsIcons attributes={attributes} />
      </div>
    )
  }
  const to = attributes.driveId
    ? SHARINGS_VIEW_ROUTE
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
