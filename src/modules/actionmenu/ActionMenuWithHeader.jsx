import { Icon } from '@linagora/twake-icons'
import React from 'react'

import { isDirectory } from 'cozy-client/dist/models/file'
import ActionsMenu from 'cozy-ui/transpiled/react/ActionsMenu'
import ActionsMenuMobileHeader from 'cozy-ui/transpiled/react/ActionsMenu/ActionsMenuMobileHeader'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'

import styles from '@/styles/actionmenu.styl'

import getMimeTypeIcon from '@/lib/getMimeTypeIcon'
import { CozyFile } from '@/models'

export const ActionMenuWithHeader = ({
  file,
  actions,
  onClose,
  anchorElRef
}) => {
  return (
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
  )
}

const MenuHeaderFile = ({ file }) => {
  const { filename, extension } = CozyFile.splitFilename(file)

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
