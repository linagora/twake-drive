import cx from 'classnames'
import React from 'react'
import { useI18n } from 'twake-i18n'

import {
  TableHead,
  TableHeader,
  TableRow
} from 'cozy-ui/transpiled/react/deprecated/Table'

import HeaderCell from './HeaderCell'

import styles from '@/styles/filelist.styl'

import { SORTABLE_ATTRIBUTES } from '@/config/sort'

const FileListHeaderDesktop = ({
  folderId,
  canSort,
  sort,
  onFolderSort,
  extraColumns,
  viewType
}) => {
  const { t } = useI18n()

  return (
    <TableHead
      className={cx(styles['fil-content-head'], {
        [styles['fil-content-head-grid-view']]: viewType === 'grid'
      })}
    >
      <TableRow className={styles['fil-content-row-head']}>
        <TableHeader
          className={cx(
            styles['fil-content-header'],
            styles['fil-content-file-select'],
            styles['fil-content-header--capitalize']
          )}
        />
        {SORTABLE_ATTRIBUTES.map(
          ({ label, attr, css, defaultOrder }, index) => {
            if (!canSort) {
              return (
                <HeaderCell
                  key={index}
                  label={label}
                  css={css}
                  className={styles['fil-content-header--capitalize']}
                />
              )
            }
            const isActive = sort && sort.attribute === attr
            return (
              <HeaderCell
                key={`key_cell_${index}`}
                label={label}
                attr={attr}
                css={css}
                defaultOrder={defaultOrder}
                order={isActive ? sort.order : null}
                onSort={(attr, order) => onFolderSort(folderId, attr, order)}
                className={styles['fil-content-header--capitalize']}
              />
            )
          }
        )}
        <TableHeader
          className={cx(
            styles['fil-content-header'],
            styles['fil-content-size'],
            styles['fil-content-header--capitalize']
          )}
        >
          {t('table.head_size')}
        </TableHeader>
        {extraColumns &&
          extraColumns.map(column => (
            <column.HeaderComponent key={column.label} />
          ))}
        <TableHeader
          className={cx(
            styles['fil-content-header'],
            styles['fil-content-header-status'],
            styles['fil-content-header--capitalize']
          )}
        >
          {t('table.head_status')}
        </TableHeader>
        <TableHeader
          className={cx(
            styles['fil-content-header'],
            styles['fil-content-header-sharing-shortcut'],
            styles['fil-content-header--capitalize']
          )}
        />
        <TableHeader
          className={cx(
            styles['fil-content-header'],
            styles['fil-content-header-action'],
            styles['fil-content-header--capitalize']
          )}
        >
          {/** Empty header cell for actions column */}
        </TableHeader>
      </TableRow>
    </TableHead>
  )
}

export { FileListHeaderDesktop }
