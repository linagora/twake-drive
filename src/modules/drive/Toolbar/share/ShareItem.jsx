import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useI18n } from 'twake-i18n'

import { SharedDocument } from 'cozy-sharing'
import { AvatarList } from 'cozy-sharing/dist/components/Avatar/AvatarList'
import ActionsMenuItem from 'cozy-ui/transpiled/react/ActionsMenu/ActionsMenuItem'
import Icon from 'cozy-ui/transpiled/react/Icon'
import ShareIcon from 'cozy-ui/transpiled/react/Icons/Share'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'

import { getPathToShareDisplayedFolder } from '@/modules/drive/Toolbar/share/helpers'

const ShareItem = ({ displayedFolder }) => {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const share = () => {
    navigate(getPathToShareDisplayedFolder(pathname))
  }

  return (
    <SharedDocument docId={displayedFolder.id}>
      {({ isSharedWithMe, recipients, link }) => (
        <ActionsMenuItem onClick={share}>
          <ListItemIcon>
            <Icon icon={ShareIcon} />
          </ListItemIcon>
          <ListItemText
            primary={t(
              isSharedWithMe
                ? 'Files.share.sharedWithMe'
                : 'toolbar.menu_share_folder'
            )}
          />
          <AvatarList recipients={recipients} link={link} size="small" />
        </ActionsMenuItem>
      )}
    </SharedDocument>
  )
}

export default ShareItem
