import { Icon, Right } from '@linagora/twake-icons'
import PropTypes from 'prop-types'
import React, { Fragment, useCallback, memo } from 'react'

import Typography from 'cozy-ui/transpiled/react/Typography'

import styles from './styles.styl'

const FilePickerBreadcrumb = ({ path, onBreadcrumbClick }) => {
  const hasPath = path && path.length > 0

  const navigateTo = useCallback(
    folder => () => onBreadcrumbClick(folder),
    [onBreadcrumbClick]
  )

  return (
    <Typography
      variant="body1"
      data-testid="file-picker-breadcrumb"
      className="u-flex u-flex-items-center u-fw-bold"
    >
      {hasPath &&
        path.map((folder, idx) => {
          if (idx < path.length - 1) {
            return (
              <Fragment key={idx}>
                <span
                  className={styles['filePickerBreadcrumb-previousPath']}
                  onClick={navigateTo(folder)}
                >
                  {folder.name}
                </span>
                <Icon
                  icon={Right}
                  className={styles['filePickerBreadcrumb-icon']}
                />
              </Fragment>
            )
          } else {
            return <span key={idx}>{folder.name}</span>
          }
        })}
    </Typography>
  )
}

FilePickerBreadcrumb.propTypes = {
  path: PropTypes.array,
  onBreadcrumbClick: PropTypes.func
}

export default memo(FilePickerBreadcrumb)
