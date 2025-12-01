import PropTypes from 'prop-types'
import React from 'react'

import Cross from 'cozy-ui/transpiled/react/Icons/Cross'

import styles from '@/styles/folder-customizer.styl'

/**
 * NoneIcon component - displays a grey square with an X to represent "no icon"
 * @param {Object} props
 * @param {number} props.size - Size of the icon
 */
export const NoneIcon = ({ size }) => {
  const iconSize = Math.round(size * 0.65)

  return (
    <span
      className={`${styles.noneIconFrame} u-flex u-flex-items-center u-flex-justify-center`}
      style={{
        width: size,
        height: size
      }}
      aria-hidden
    >
      <Cross
        width={iconSize}
        height={iconSize}
        fill="var(--secondaryTextColor)"
      />
    </span>
  )
}

NoneIcon.propTypes = {
  size: PropTypes.number
}

NoneIcon.displayName = 'NoneIcon'
