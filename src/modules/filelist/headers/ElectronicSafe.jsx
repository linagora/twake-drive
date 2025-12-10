import React from 'react'
import { useI18n } from 'twake-i18n'

import Icon from 'cozy-ui/transpiled/react/Icon'
import SafeIcon from 'cozy-ui/transpiled/react/Icons/Safe'
import { TableHeader } from 'cozy-ui/transpiled/react/deprecated/Table'

import styles from '@/styles/filelist.styl'

import CertificationTooltip from '@/modules/certifications/CertificationTooltip'

const ElectronicSafeHeader = () => {
  const { t } = useI18n()

  return (
    <TableHeader className={styles['fil-content-header']}>
      <CertificationTooltip
        body={t('table.tooltip.electronicSafe.title')}
        caption={t('table.tooltip.electronicSafe.caption')}
        content={<Icon icon={SafeIcon} size={16} />}
      />
    </TableHeader>
  )
}

export default ElectronicSafeHeader
