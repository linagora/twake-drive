import { Icon, Right } from '@linagora/twake-icons'
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
      variant="body1"
      data-testid="file-picker-breadcrumb"
      className="u-flex u-flex-items-center u-fw-bold"
    >
      {isMobile && hasPath ? (
        <>
          {path.length > 1 && <BackButton onClick={navigateBack} />}
          <span>{path[path.length - 1].name}</span>
        </>
      ) : (
        hasPath &&
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
