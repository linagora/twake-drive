import { Icon } from '@linagora/twake-icons'
import classNames from 'classnames'
import React, { useCallback } from 'react'

import IconButton from 'cozy-ui/transpiled/react/IconButton'

import styles from '@/modules/breadcrumb/styles/breadcrumb.styl'

const DesktopBreadcrumbItem = ({ item, isCurrent, onClick, icon }) => {
  const handleClick = useCallback(
    e => {
      e.stopPropagation()
      onClick(item)
    },
    [onClick, item]
  )

  return (
    <span
      className={classNames(
        isCurrent ? styles['fil-path-current-name'] : styles['fil-path-link'],
        styles['fil-path-title']
      )}
      key={item.name}
      onClick={handleClick}
    >
      {icon ? (
        <IconButton size="small" aria-label={item.name}>
          <Icon icon={icon} />
        </IconButton>
      ) : (
        item.name
      )}
    </span>
  )
}

export { DesktopBreadcrumbItem }
