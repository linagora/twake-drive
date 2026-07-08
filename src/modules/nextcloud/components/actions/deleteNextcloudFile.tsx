import { Icon, Trash } from '@linagora/twake-icons'
import React, { forwardRef } from 'react'

import { Action } from 'cozy-ui/transpiled/react/ActionsMenu/Actions'
import ActionsMenuItem from 'cozy-ui/transpiled/react/ActionsMenu/ActionsMenuItem'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'

import { navigateToModalWithMultipleFile } from '@/modules/actions/helpers'

interface DeleteNextcloudFileProps {
  t: (key: string) => string
  pathname: string
  navigate: (path: string) => void
  search: string
}

/**
 * Deletes a Nextcloud file.
 *
 * @param t - The translation function.
 * @param pathname - The current pathname.
 * @param navigate - The navigation function.
 * @param search - The current search string.
 * @returns An actions menu item to delete a Nextcloud file
 */
export const deleteNextcloudFile = ({
  t,
  pathname,
  navigate,
  search
}: DeleteNextcloudFileProps): Action => {
  const label = t('SelectionBar.trash')
  const icon = Trash

  return {
    name: 'deleteNextcloudFile',
    label,
    icon,
    action: (files): void => {
      navigateToModalWithMultipleFile({
        files,
        pathname,
        navigate,
        path: 'delete',
        search
      })
    },
    Component: forwardRef(function DeleteNextcloudFile(props, ref) {
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
  }
}
