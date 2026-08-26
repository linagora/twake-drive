import { Icon, Right } from '@linagora/twake-icons'
import cx from 'classnames'
import PropTypes from 'prop-types'
import React, { Fragment, useCallback, memo } from 'react'

import Typography from 'cozy-ui/transpiled/react/Typography'
import { useBreakpoints } from 'cozy-ui/transpiled/react/providers/Breakpoints'

import styles from './styles.styl'

import { BackButton } from '@/components/Button/BackButton'

const FilePickerBreadcrumb = ({ path, onBreadcrumbClick }) => {
  const { isMobile } = useBreakpoints()
  const hasPath = path && path.length > 0

  const navigateTo = useCallback(
    folder => () => onBreadcrumbClick(folder),
    [onBreadcrumbClick]
  )
  const navigateBack = useCallback(() => {
    onBreadcrumbClick(path[path.length - 2])
  }, [onBreadcrumbClick, path])

  return (
    <Typography
      variant="body2"
      data-testid="file-picker-breadcrumb"
      className="u-flex u-flex-items-center u-fw-bold u-h-2 u-h-2-half-s"
    >
      {hasPath && path.length > 1 && (
        <BackButton onClick={navigateBack} size="small" />
      )}
      {isMobile && hasPath ? (
        <span>{path[path.length - 1].name}</span>
      ) : (
        hasPath &&
        path.map((folder, idx) => {
          if (idx < path.length - 1) {
            return (
              <Fragment key={idx}>
                <button
                  type="button"
                  className={cx(
                    styles['filePickerBreadcrumb-previousPath'],
                    'u-c-pointer'
                  )}
                  onClick={navigateTo(folder)}
                >
                  {folder.name}
                </button>
                <Icon
                  icon={Right}
                  className={cx(
                    styles['filePickerBreadcrumb-icon'],
                    'u-mh-half'
                  )}
                />
              </Fragment>
            )
          } else {
            return <span key={idx}>{folder.name}</span>
          }
        })
      )}
    </Typography>
  )
}

FilePickerBreadcrumb.propTypes = {
  path: PropTypes.array,
  onBreadcrumbClick: PropTypes.func
}

export default memo(FilePickerBreadcrumb)
