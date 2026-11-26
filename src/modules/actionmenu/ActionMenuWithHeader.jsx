import React from 'react'

import { Icon } from '@linagora/twake-icons'
import { isDirectory, splitFilename } from 'cozy-client/dist/models/file'
import ActionsMenu from 'cozy-ui/transpiled/react/ActionsMenu'
import ActionsMenuMobileHeader from 'cozy-ui/transpiled/react/ActionsMenu/ActionsMenuMobileHeader'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'

import styles from '@/styles/actionmenu.styl'

import getMimeTypeIcon from '@/lib/getMimeTypeIcon'

const stopPropagation = event => event.stopPropagation()

const stopContextMenu = event => {
  event.stopPropagation()
  event.preventDefault()
}

export const ActionMenuWithHeader = ({
  file,
  actions,
  onClose,
  anchorElRef
}) => {
  return (
    // The menu renders in a portal, but its events still bubble through the
    // React tree to the row or tile, which selects it.
    <span onClick={stopPropagation} onContextMenu={stopContextMenu}>
      <ActionsMenu
        open
        ref={anchorElRef}
        onClose={onClose}
        actions={actions}
        docs={[file]}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right'
        }}
      >
        <ActionsMenuMobileHeader>
          <MenuHeaderFile file={file} />
        </ActionsMenuMobileHeader>
      </ActionsMenu>
    </span>
  )
}

const MenuHeaderFile = ({ file }) => {
  const { filename, extension } = splitFilename(file)

  return (
    <>
      <ListItemIcon>
        <Icon
          icon={getMimeTypeIcon(isDirectory(file), file.name, file.mime)}
          size={32}
        />
      </ListItemIcon>
      <ListItemText
        primary={
          <>
            <span className={styles['fil-mobileactionmenu-file-name']}>
              {filename}
            </span>
            <span className={styles['fil-mobileactionmenu-file-ext']}>
              {extension}
            </span>
          </>
        }
        primaryTypographyProps={{ variant: 'h6' }}
      />
    </>
  )
}
