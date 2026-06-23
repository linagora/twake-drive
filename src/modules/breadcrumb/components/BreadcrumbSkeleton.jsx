import React from 'react'

import Skeleton from 'cozy-ui/transpiled/react/Skeleton'

import styles from '@/modules/breadcrumb/styles/breadcrumb.styl'

// Reuses the breadcrumb backdrop so the placeholder grows to fill the same
// flex space as the real breadcrumb. Without it the topbar collapses while the
// path loads and the view-toggle icons jump from left to right.
const BreadcrumbSkeleton = () => (
  <div
    className={styles['fil-path-backdrop']}
    data-testid="breadcrumb-skeleton"
  >
    <Skeleton variant="text" animation="wave" width={200} height={24} />
  </div>
)

export default BreadcrumbSkeleton
