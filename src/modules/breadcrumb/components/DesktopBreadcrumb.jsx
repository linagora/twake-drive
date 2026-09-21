import { Icon, Folder, Right } from '@linagora/twake-icons'
import React, { useEffect, useMemo, useState } from 'react'

import ActionsMenu from 'cozy-ui/transpiled/react/ActionsMenu'
import ActionsMenuItem from 'cozy-ui/transpiled/react/ActionsMenu/ActionsMenuItem'
import BreadcrumbMui from 'cozy-ui/transpiled/react/Breadcrumbs'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'
import { useI18n } from 'twake-i18n'

import styles from '@/modules/breadcrumb/styles/breadcrumb.styl'

import { ROOT_DIR_ID } from '@/constants/config'
import { DesktopBreadcrumbItem } from '@/modules/breadcrumb/components/DesktopBreadcrumbItem'

const DesktopBreadcrumb = ({ onBreadcrumbClick, path }) => {
  const { t } = useI18n()

  const expandText = useMemo(() => t('breadcrumb.label'), [t])
  const [dropdownTrigger, setDropdownTrigger] = useState(
    document.querySelector(`[aria-label="${expandText}"]`)
  )
  const anchorElRef = useMemo(
    () => ({ current: dropdownTrigger }),
    [dropdownTrigger]
  )
  const [menuDisplayed, setMenuDisplayed] = useState(false)

  const closeMenu = () => setMenuDisplayed(false)

  const handleDropdownTriggerClick = e => {
    e.stopPropagation()
    setMenuDisplayed(true)
  }

  useEffect(() => {
    closeMenu()
    setDropdownTrigger(document.querySelector(`[aria-label="${expandText}"]`))
  }, [path]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const trigger = anchorElRef.current
    if (trigger) {
      trigger.addEventListener('click', handleDropdownTriggerClick)
      return () => {
        closeMenu()
        trigger.removeEventListener('click', handleDropdownTriggerClick)
      }
    }
  }, [anchorElRef.current]) // eslint-disable-line react-hooks/exhaustive-deps, react-hooks/refs

  const Separator = (
    <Icon icon={Right} className={styles['fil-path-separator']} />
  )

  return (
    <>
      <BreadcrumbMui
        className={styles['fil-path-backdrop']}
        maxItems={3}
        separator={Separator}
        itemsAfterCollapse={2}
        expandText={expandText}
      >
        {path.map((breadcrumbPath, index) => {
          if (path.length > 1 && breadcrumbPath.id === ROOT_DIR_ID) {
            return (
              <DesktopBreadcrumbItem
                key={breadcrumbPath.name}
                onClick={onBreadcrumbClick}
                item={breadcrumbPath}
                isCurrent={index === path.length - 1}
                icon={Folder}
              />
            )
          }

          return (
            <DesktopBreadcrumbItem
              key={breadcrumbPath.name}
              onClick={onBreadcrumbClick}
              item={breadcrumbPath}
              isCurrent={index === path.length - 1}
            />
          )
        })}
      </BreadcrumbMui>
      {menuDisplayed && (
        <ActionsMenu
          open
          // eslint-disable-next-line react-hooks/refs
          ref={anchorElRef}
          onClose={closeMenu}
          actions={[]}
          docs={[]}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'left'
          }}
        >
          {path.slice(1, -2).map(breadcrumbPath => (
            <ActionsMenuItem
              key={breadcrumbPath.name}
              onClick={e => {
                e.stopPropagation()
                onBreadcrumbClick(breadcrumbPath)
              }}
            >
              <ListItemText primary={breadcrumbPath.name} />
            </ActionsMenuItem>
          ))}
        </ActionsMenu>
      )}
    </>
  )
}

export default DesktopBreadcrumb
