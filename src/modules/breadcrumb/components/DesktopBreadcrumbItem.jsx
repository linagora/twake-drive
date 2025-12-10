import classNames from 'classnames'
import React, { useCallback } from 'react'
import { useI18n } from 'twake-i18n'

import Icon from 'cozy-ui/transpiled/react/Icon'
import IconButton from 'cozy-ui/transpiled/react/IconButton'

import styles from '@/modules/breadcrumb/styles/breadcrumb.styl'

const DesktopBreadcrumbItem = ({ item, isCurrent, onClick, icon }) => {
  const { t } = useI18n()
  const handleClick = useCallback(
    e => {
      e.stopPropagation()
      onClick(item)
    },
    [onClick, item]
  )

  const itemName =
    item.id === 'io.cozy.files.shared-drives-dir'
      ? t('breadcrumb.title_shared_drives')
      : item.name

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
        itemName
      )}
    </span>
  )
}

export { DesktopBreadcrumbItem }
