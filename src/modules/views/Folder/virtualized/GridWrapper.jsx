import cx from 'classnames'
import React, { forwardRef } from 'react'

import styles from '@/styles/folder-view.styl'

const GridWrapper = forwardRef(({ style, children }, ref) => (
  <div
    ref={ref}
    className={cx(
      styles['fil-folder-body-grid'],
      styles['fil-folder-body-grid-virtualized']
    )}
    style={style}
  >
    {children}
  </div>
))

GridWrapper.displayName = 'GridWrapper'

export default GridWrapper
