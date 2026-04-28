import React, { forwardRef } from 'react'

import { SharedRecipients } from 'cozy-sharing'
import ActionsMenuItem from 'cozy-ui/transpiled/react/ActionsMenu/ActionsMenuItem'
import Icon from 'cozy-ui/transpiled/react/Icon'
import ShareIcon from 'cozy-ui/transpiled/react/Icons/Share'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'

import { navigateToModal } from '@/modules/actions/helpers'
import { isFromSharedDriveRecipient } from '@/modules/shareddrives/helpers'

const share = ({
  t,
  shouldHideIfSharedDriveRecipient,
  hasWriteAccess,
  navigate,
  pathname,
  allLoaded
}) => {
  const label = t('Files.share.cta')
  const icon = ShareIcon

  return {
    name: 'share',
    label,
    icon,
    allowInfectedFiles: false,
    displayCondition: files => {
      // If shared drive recipient:
      // - in sharing view, we hide it because it works differently
      // - in shared drive view, we show it
      if (files?.length === 1 && isFromSharedDriveRecipient(files[0])) {
        return !shouldHideIfSharedDriveRecipient
      }

      return (
        allLoaded && // We need to wait for the sharing context to be completely loaded to avoid race conditions
        hasWriteAccess &&
        files?.length === 1
      )
    },
    action: files =>
      navigateToModal({ navigate, pathname, files, path: 'share' }),
    Component: forwardRef(function ShareMenuItemInMenu(props, ref) {
      const { isMobile } = useBreakpoints()

      return (
        <ActionsMenuItem {...props} ref={ref}>
          <ListItemIcon>
            <Icon icon={icon} />
          </ListItemIcon>
          <ListItemText primary={label} />
          {isMobile && props.docs ? (
            <ListItemIcon classes={{ root: 'u-w-auto' }}>
              <SharedRecipients docId={props.docs[0].id} size="small" />
            </ListItemIcon>
          ) : null}
        </ActionsMenuItem>
      )
    })
  }
}

export { share }
