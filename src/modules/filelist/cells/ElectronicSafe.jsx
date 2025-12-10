import cx from 'classnames'
import get from 'lodash/get'
import React from 'react'
import { useI18n } from 'twake-i18n'

import { TableCell } from 'cozy-ui/transpiled/react/deprecated/Table'
import AppIcon from 'cozy-ui-plus/dist/AppIcon'

import styles from '@/styles/filelist.styl'

import CertificationTooltip from '@/modules/certifications/CertificationTooltip'

const ElectronicSafe = ({ file }) => {
  const { t } = useI18n()

  const hasDataToshow = get(file, 'metadata.electronicSafe')
  const konnectorName = get(file, 'cozyMetadata.uploadedBy.slug')

  return (
    <TableCell
      className={cx(styles['fil-content-cell'], styles['fil-content-narrow'])}
    >
      {hasDataToshow ? (
        <CertificationTooltip
          body={t('table.tooltip.electronicSafe.title')}
          caption={t('table.tooltip.electronicSafe.caption')}
          content={<AppIcon app={konnectorName} type="konnector" />}
        />
      ) : (
        '—'
      )}
    </TableCell>
  )
}

export default ElectronicSafe
