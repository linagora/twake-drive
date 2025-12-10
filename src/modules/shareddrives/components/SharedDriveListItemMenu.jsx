import React, { useRef } from 'react'
import { useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { useI18n } from 'twake-i18n'

import { useClient } from 'cozy-client'
import ActionsMenu from 'cozy-ui/transpiled/react/ActionsMenu'
import {
  divider,
  makeActions
} from 'cozy-ui/transpiled/react/ActionsMenu/Actions'
import Icon from 'cozy-ui/transpiled/react/Icon'
import IconButton from 'cozy-ui/transpiled/react/IconButton'
import DotsIcon from 'cozy-ui/transpiled/react/Icons/Dots'
import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'

import { deleteSharedDrive } from '@/modules/shareddrives/components/actions/deleteSharedDrive'
import { leaveSharedDrive } from '@/modules/shareddrives/components/actions/leaveSharedDrive'
import { manageAccess } from '@/modules/shareddrives/components/actions/manageAccess'

const SharedDriveListItemMenu = ({ isOpen, toggleMenu, sharedDrive }) => {
  const anchorRef = useRef(null)
  const client = useClient()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { showAlert } = useAlert()

  const { t } = useI18n()

  const actions = makeActions(
    [
      manageAccess, // owner
      sharedDrive.owner && divider,
      deleteSharedDrive, // owner
      leaveSharedDrive // recipient
    ],
    {
      sharedDrive,
      client,
      dispatch,
      navigate,
      showAlert,
      t
    }
  )

  return (
    <>
      <IconButton ref={anchorRef} onClick={toggleMenu} size="small">
        <Icon icon={DotsIcon} />
      </IconButton>
      <ActionsMenu
        ref={anchorRef}
        open={isOpen}
        actions={actions}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left'
        }}
        autoClose
        onClose={toggleMenu}
      ></ActionsMenu>
    </>
  )
}

export { SharedDriveListItemMenu }
