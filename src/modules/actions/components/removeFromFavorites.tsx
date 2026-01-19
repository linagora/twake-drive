import React, { forwardRef } from 'react'

import { splitFilename } from 'cozy-client/dist/models/file'
import CozyClient from 'cozy-client/types/CozyClient'
import ActionsMenuItem from 'cozy-ui/transpiled/react/ActionsMenu/ActionsMenuItem'
import Icon from 'cozy-ui/transpiled/react/Icon'
import StarIcon from 'cozy-ui/transpiled/react/Icons/Star'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'

import type { ActionWithPolicy } from '../types'

interface removeFromFavoritesProps {
  t: (key: string, options?: Record<string, unknown>) => string
  client: CozyClient
  showAlert: import('cozy-ui/transpiled/react/providers/Alert').showAlertFunction
}

const removeFromFavorites = ({
  t,
  client,
  showAlert
}: removeFromFavoritesProps): ActionWithPolicy => {
  const label = t('favorites.label.remove')
  const icon = StarIcon

  return {
    name: 'removeFromFavorites',
    label,
    icon,
    allowInfectedFiles: false,
    displayCondition: docs =>
      docs.length > 0 &&
      docs.every(doc => doc.cozyMetadata?.favorite) &&
      !docs[0]?.driveId,
    action: async (files): Promise<void> => {
      try {
        for (const file of files) {
          await client.save({
            ...file,
            cozyMetadata: {
              ...file.cozyMetadata,
              favorite: false
            }
          })
        }

        const { filename } = splitFilename(files[0])
        showAlert({
          message: t('favorites.success.remove', {
            filename,
            smart_count: files.length
          }),
          severity: 'success'
        })
      } catch (error) {
        showAlert({ message: t('favorites.error'), severity: 'error' })
      }
    },
    Component: forwardRef(function RemoveFromFavorites(props, ref) {
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

export { removeFromFavorites }
