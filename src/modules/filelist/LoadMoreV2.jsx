import cx from 'classnames'
import PropTypes from 'prop-types'
import React from 'react'
import { useI18n } from 'twake-i18n'

import LoadMore from 'cozy-ui/transpiled/react/LoadMore'
import { TableRow } from 'cozy-ui/transpiled/react/deprecated/Table'

import styles from '@/styles/filelist.styl'

const LoadMoreFiles = ({ fetchMore }) => {
  const { t } = useI18n()
  return (
    <TableRow
      className={cx(
        styles['fil-content-row'],
        styles['fil-content-row--center']
      )}
    >
      <LoadMore fetchMore={fetchMore} label={t('table.load_more')} />
    </TableRow>
  )
}

LoadMoreFiles.propTypes = {
  fetchMore: PropTypes.func.isRequired
}

export default LoadMoreFiles
