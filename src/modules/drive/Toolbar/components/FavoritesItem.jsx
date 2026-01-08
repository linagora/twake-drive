import React from 'react'
import { useI18n } from 'twake-i18n'

import { useClient } from 'cozy-client'
import { splitFilename } from 'cozy-client/dist/models/file'
import ActionsMenuItem from 'cozy-ui/transpiled/react/ActionsMenu/ActionsMenuItem'
import Icon from 'cozy-ui/transpiled/react/Icon'
import StarIcon from 'cozy-ui/transpiled/react/Icons/Star'
import StarOutlineIcon from 'cozy-ui/transpiled/react/Icons/StarOutline'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'
import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'

const FavoritesItem = ({ displayedFolder }) => {
  const { showAlert } = useAlert()
  const { t } = useI18n()
  const client = useClient()

  const isFavorite = displayedFolder?.cozyMetadata?.favorite
  const labelKey = isFavorite ? 'remove' : 'add'

  const handleClick = async () => {
    if (!displayedFolder) return

    try {
      await client.save({
        ...displayedFolder,
        cozyMetadata: {
          ...displayedFolder.cozyMetadata,
          favorite: !isFavorite
        }
      })

      const { filename } = splitFilename(displayedFolder)
      showAlert({
        message: t(`favorites.success.${labelKey}`, {
          filename,
          smart_count: 1
        }),
        severity: 'success'
      })
    } catch (error) {
      showAlert({ message: t('favorites.error'), severity: 'error' })
    }
  }

  const icon = isFavorite ? StarIcon : StarOutlineIcon

  return (
    <ActionsMenuItem onClick={handleClick}>
      <ListItemIcon>
        <Icon icon={icon} />
      </ListItemIcon>
      <ListItemText primary={t(`favorites.label.${labelKey}`)} />
    </ActionsMenuItem>
  )
}

export default FavoritesItem
