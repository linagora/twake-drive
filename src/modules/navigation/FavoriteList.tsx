import React, { FC } from 'react'
import { useI18n } from 'twake-i18n'

import { useQuery } from 'cozy-client'
import { IOCozyFile } from 'cozy-client/types/types'
import { NavDesktopDropdown } from 'cozy-ui/transpiled/react/Nav'

import { FavoriteListItem } from '@/modules/navigation/FavoriteListItem'
import { buildFavoritesQuery } from '@/queries'

interface FavoriteListProps {
  clickState: [string, (value: string | undefined) => void]
}

const FavoriteList: FC<FavoriteListProps> = ({ clickState }) => {
  const { t } = useI18n()
  const favoritesQuery = buildFavoritesQuery({
    sortAttribute: 'name',
    sortOrder: 'desc'
  })
  const favoritesResult = useQuery(
    favoritesQuery.definition,
    favoritesQuery.options
  ) as {
    data?: IOCozyFile[] | null
  }

  if (favoritesResult.data && favoritesResult.data.length > 0) {
    return (
      <NavDesktopDropdown label={t('Nav.item_favorites')}>
        {favoritesResult.data.map(file => (
          <FavoriteListItem
            key={file._id}
            file={file}
            clickState={clickState}
          />
        ))}
      </NavDesktopDropdown>
    )
  }

  return null
}

export { FavoriteList }
