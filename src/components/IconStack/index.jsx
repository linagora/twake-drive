import classNames from 'classnames'
import PropTypes from 'prop-types'
import React from 'react'

import styles from './styles.styl'

const IconStack = ({
  backgroundClassName,
  foregroundClassName,
  backgroundIcon,
  foregroundIcon,
  offset
}) => {
  return (
    <div
      className={classNames(styles['IconStack-wrapper'], backgroundClassName)}
    >
      {backgroundIcon}
      {foregroundIcon && (
        <div
          style={{
            marginTop: offset?.vertical,
            marginLeft: offset?.horizontal
          }}
          className={classNames(
            styles['IconStack-foregroundIcon'],
            foregroundClassName
          )}
        >
          {foregroundIcon}
        </div>
      )}
    </div>
  )
}

IconStack.propTypes = {
  backgroundClassName: PropTypes.string,
  foregroundClassName: PropTypes.string,
  backgroundIcon: PropTypes.node,
  foregroundIcon: PropTypes.node,
  offset: PropTypes.shape({
    vertical: PropTypes.string,
    horizontal: PropTypes.string
  })
}

export default IconStack
