import cx from 'classnames'
import React, { useState, useCallback } from 'react'
import { useI18n } from 'twake-i18n'

import { useSharingContext } from 'cozy-sharing'
import Button from 'cozy-ui/transpiled/react/Buttons'
import Icon from 'cozy-ui/transpiled/react/Icon'
import ListIcon from 'cozy-ui/transpiled/react/Icons/List'
import ListMinIcon from 'cozy-ui/transpiled/react/Icons/ListMin'
import {
  TableHead,
  TableHeader,
  TableRow
} from 'cozy-ui/transpiled/react/deprecated/Table'

import MobileSortMenu from './MobileSortMenu'
import ShareButton from '../drive/Toolbar/share/ShareButton'

import styles from '@/styles/filelist.styl'

import { ROOT_DIR_ID, TRASH_DIR_ID } from '@/constants/config'
import { useCurrentFolderId } from '@/hooks'
import { useSelectionContext } from '@/modules/selection/SelectionProvider'

const FileListHeaderMobile = ({
  canSort,
  sort,
  onFolderSort,
  viewType,
  switchViewType
}) => {
  const { t } = useI18n()
  const [isShowingSortMenu, setIsShowingSortMenu] = useState(false)
  const { isSelectionBarVisible } = useSelectionContext()
  const { allLoaded } = useSharingContext()

  const folderId = useCurrentFolderId()
  const showShareButton = Boolean(
    folderId && folderId !== ROOT_DIR_ID && folderId !== TRASH_DIR_ID
  )

  const isDisabled = isSelectionBarVisible
  const isSharingDisabled = isDisabled || !allLoaded

  const showSortMenu = useCallback(
    () => setIsShowingSortMenu(true),
    [setIsShowingSortMenu]
  )
  const hideSortMenu = useCallback(
    () => setIsShowingSortMenu(false),
    [setIsShowingSortMenu]
  )

  return (
    <TableHead className={styles['fil-content-mobile-head']}>
      <TableRow className={styles['fil-content-row-head']}>
        {canSort ? (
          <TableHeader
            onClick={showSortMenu}
            className={cx(
              styles['fil-content-mobile-header'],
              styles['fil-content-header--capitalize'],
              {
                [styles['fil-content-header-sortasc']]: sort.order === 'asc',
                [styles['fil-content-header-sortdesc']]: sort.order === 'desc'
              }
            )}
          >
            {t(`table.mobile.head_${sort.attribute}_${sort.order}`)}
          </TableHeader>
        ) : (
          <div className="u-flex-auto" /> // to keep the viewType switch to the right side
        )}

        {isShowingSortMenu && (
          <MobileSortMenu
            t={t}
            sort={sort}
            onClose={hideSortMenu}
            onSort={(attr, order) => onFolderSort(folderId, attr, order)}
          />
        )}
        {showShareButton && (
          <TableHeader
            className={cx(
              styles['fil-content-mobile-header'],
              styles['fil-content-header--capitalize']
            )}
          >
            <ShareButton isDisabled={isSharingDisabled} useShortLabel={true} />
          </TableHeader>
        )}
        <TableHeader
          className={cx(
            styles['fil-content-mobile-header'],
            styles['fil-content-header-action'],
            styles['fil-content-header--capitalize']
          )}
        >
          <Button
            variant="text"
            onClick={() => {
              switchViewType(viewType === 'list' ? 'grid' : 'list')
            }}
            label={
              <Icon
                icon={viewType === 'list' ? ListMinIcon : ListIcon}
                size={17}
              />
            }
          />
        </TableHeader>
      </TableRow>
    </TableHead>
  )
}

export { FileListHeaderMobile }
