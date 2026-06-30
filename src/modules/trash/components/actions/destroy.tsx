import { Icon, Trash } from '@linagora/twake-icons'
import React, { forwardRef } from 'react'

import ActionsMenuItem from 'cozy-ui/transpiled/react/ActionsMenu/ActionsMenuItem'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'

import { navigateToModalWithMultipleFile } from '@/modules/actions/helpers'
import type { ActionWithPolicy } from '@/modules/actions/types'

interface destroyProps {
  t: (key: string, options?: Record<string, unknown>) => string
  navigate: (to: string) => void
  pathname: string
  search?: string
}

export const destroy = ({
  t,
  navigate,
  pathname,
  search
}: destroyProps): ActionWithPolicy => {
  const label = t('SelectionBar.destroy')
  const icon = Trash

  return {
    name: 'destroy',
    label,
    icon,
    allowTrashed: true,
    action: (files): void => {
      navigateToModalWithMultipleFile({
        files,
        pathname,
        navigate,
        path: 'destroy',
        search
      })
    },
    Component: forwardRef(function Destroy(props, ref) {
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
