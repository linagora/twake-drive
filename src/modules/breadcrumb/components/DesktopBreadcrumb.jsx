import React, { useEffect, useMemo, useState } from 'react'
import { useI18n } from 'twake-i18n'

import ActionsMenu from 'cozy-ui/transpiled/react/ActionsMenu'
import ActionsMenuItem from 'cozy-ui/transpiled/react/ActionsMenu/ActionsMenuItem'
import BreadcrumbMui from 'cozy-ui/transpiled/react/Breadcrumbs'
import Icon from 'cozy-ui/transpiled/react/Icon'
import FileTypeSharedDriveIcon from 'cozy-ui/transpiled/react/Icons/FileTypeSharedDriveGrey'
import FolderIcon from 'cozy-ui/transpiled/react/Icons/Folder'
import RightIcon from 'cozy-ui/transpiled/react/Icons/Right'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'

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
  }, [anchorElRef.current]) // eslint-disable-line react-hooks/exhaustive-deps

  const Separator = (
    <Icon icon={RightIcon} className={styles['fil-path-separator']} />
  )

  // When we are in a shared drive, we want to display the shared drive icon
  // in first position to reduce the number of displayed path elements
  const pathToDisplay = useMemo(() => {
    const sharedDriveIndex = path.findIndex(
      item => item.id === 'io.cozy.files.shared-drives-dir'
    )
    if (sharedDriveIndex !== -1 && path.length > 2) {
      return path.slice(sharedDriveIndex)
    }

    return path
  }, [path])

  return (
    <>
      <BreadcrumbMui
        className={styles['fil-path-backdrop']}
        maxItems={3}
        separator={Separator}
        itemsAfterCollapse={2}
        expandText={expandText}
      >
        {pathToDisplay.map((breadcrumbPath, index) => {
          if (pathToDisplay.length > 1 && breadcrumbPath.id === ROOT_DIR_ID) {
            return (
              <DesktopBreadcrumbItem
                key={breadcrumbPath.name}
                onClick={onBreadcrumbClick}
                item={breadcrumbPath}
                isCurrent={index === pathToDisplay.length - 1}
                icon={FolderIcon}
              />
            )
          }

          if (
            index === 0 &&
            breadcrumbPath.id === 'io.cozy.files.shared-drives-dir'
          ) {
            return (
              <DesktopBreadcrumbItem
                key={breadcrumbPath.name}
                onClick={onBreadcrumbClick}
                item={breadcrumbPath}
                isCurrent={index === pathToDisplay.length - 1}
                icon={FileTypeSharedDriveIcon}
              />
            )
          }

          return (
            <DesktopBreadcrumbItem
              key={breadcrumbPath.name}
              onClick={onBreadcrumbClick}
              item={breadcrumbPath}
              isCurrent={index === pathToDisplay.length - 1}
            />
          )
        })}
      </BreadcrumbMui>

      {menuDisplayed && (
        <ActionsMenu
          open
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
