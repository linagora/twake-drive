import PropTypes from 'prop-types'
import React, { Fragment, useCallback, memo } from 'react'

import Icon from 'cozy-ui/transpiled/react/Icon'
import RightIcon from 'cozy-ui/transpiled/react/Icons/Right'
import Typography from 'cozy-ui/transpiled/react/Typography'
import withBreakpoints from 'cozy-ui/transpiled/react/helpers/withBreakpoints'

import styles from './styles.styl'

const FilePickerBreadcrumb = ({ path, onBreadcrumbClick, breakpoints }) => {
  const isMobile = breakpoints.isMobile
  const hasPath = path && path.length > 0

  const navigateTo = useCallback(
    folder => () => onBreadcrumbClick(folder),
    [onBreadcrumbClick]
  )

  return (
    <Typography variant="h4" className="u-flex u-flex-items-center">
      {hasPath
        ? isMobile
          ? path[path.length - 1].name
          : path.map((folder, idx) => {
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
                      icon={RightIcon}
                      className={styles['filePickerBreadcrumb-icon']}
                    />
                  </Fragment>
                )
              } else {
                return <span key={idx}>{folder.name}</span>
              }
            })
        : null}
    </Typography>
  )
}

FilePickerBreadcrumb.propTypes = {
  breakpoints: PropTypes.shape({
    isMobile: PropTypes.bool.isRequired
  }).isRequired,
  path: PropTypes.array,
  onBreadcrumbClick: PropTypes.func
}

export default memo(withBreakpoints()(FilePickerBreadcrumb))
