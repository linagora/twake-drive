import React, { forwardRef } from 'react'

import ActionsMenuItem from 'cozy-ui/transpiled/react/ActionsMenu/ActionsMenuItem'
import Icon from 'cozy-ui/transpiled/react/Icon'
import TrashIcon from 'cozy-ui/transpiled/react/Icons/Trash'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'

import DeleteConfirm from '@/modules/drive/DeleteConfirm'

const makeComponent = ({ icon, t, byDocId, isOwner }) => {
  const Component = forwardRef((props, ref) => {
    const sharedWithMe =
      byDocId !== undefined &&
      byDocId[props.docs[0].id] &&
      !isOwner(props.docs[0].id)

    const label = sharedWithMe
      ? t('toolbar.leave')
      : props.docs.length > 1
      ? t('SelectionBar.trash_all')
      : t('SelectionBar.trash')

    return (
      <ActionsMenuItem {...props} ref={ref}>
        <ListItemIcon>
          <Icon icon={icon} color="var(--errorColor)" />
        </ListItemIcon>
        <ListItemText
          primary={label}
          primaryTypographyProps={{ color: 'error' }}
        />
      </ActionsMenuItem>
    )
  })
  Component.displayName = 'Trash'

  return Component
}

export const trash = ({
  t,
  pushModal,
  popModal,
  hasWriteAccess,
  refresh,
  byDocId,
  isOwner,
  driveId
}) => {
  const icon = TrashIcon

  return {
    name: 'trash',
    icon,
    allowInfectedFiles: true,
    displayCondition: files => files.length > 0 && hasWriteAccess,
    action: files => {
      return pushModal(
        <DeleteConfirm
          files={files}
          afterConfirmation={refresh}
          onClose={popModal}
          driveId={driveId}
        />
      )
    },
    Component: makeComponent({ icon, t, byDocId, isOwner })
  }
}
