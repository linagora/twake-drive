import { Icon, MultiFiles } from '@linagora/twake-icons'
import React, { forwardRef } from 'react'

import { isFile } from 'cozy-client/dist/models/file'
import ActionsMenuItem from 'cozy-ui/transpiled/react/ActionsMenu/ActionsMenuItem'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'

import { navigateToModalWithMultipleFile } from '../helpers'
import type { ActionWithPolicy } from '../types'

interface duplicateToProps {
  t: (key: string, options?: Record<string, unknown>) => string
  navigate: (to: string) => void
  pathname: string
  isMobile: boolean
  search?: string
  canDuplicate?: boolean
}

const duplicateTo = ({
  t,
  pathname,
  navigate,
  isMobile,
  search,
  canDuplicate = true
}: duplicateToProps): ActionWithPolicy => {
  const icon = MultiFiles
  const label = isMobile
    ? t('actions.duplicateToMobile.label')
    : t('actions.duplicateTo.label')

  return {
    name: 'duplicateTo',
    label,
    icon,
    allowInfectedFiles: false,
    displayCondition: docs =>
      docs.length === 1 && isFile(docs[0]) && canDuplicate,
    action: (files): void => {
      navigateToModalWithMultipleFile({
        files,
        pathname,
        navigate,
        path: 'duplicate',
        search
      })
    },
    Component: forwardRef(function DuplicateTo(props, ref) {
      return (
        <ActionsMenuItem {...props} ref={ref}>
          <ListItemIcon>
            <Icon icon={icon} />
          </ListItemIcon>
          <ListItemText primary={label} />
        </ActionsMenuItem>
      )
    })
  }
}

export { duplicateTo }
