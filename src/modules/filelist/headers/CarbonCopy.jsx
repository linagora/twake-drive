import React from 'react'
import { useI18n } from 'twake-i18n'

import Icon from 'cozy-ui/transpiled/react/Icon'
import CarbonCopyIcon from 'cozy-ui/transpiled/react/Icons/CarbonCopy'
import { TableHeader } from 'cozy-ui/transpiled/react/deprecated/Table'

import styles from '@/styles/filelist.styl'

import CertificationTooltip from '@/modules/certifications/CertificationTooltip'

const CarbonCopyHeader = () => {
  const { t } = useI18n()

  return (
    <TableHeader className={styles['fil-content-header']}>
      <CertificationTooltip
        body={t('table.tooltip.carbonCopy.title')}
        caption={t('table.tooltip.carbonCopy.caption')}
        content={<Icon icon={CarbonCopyIcon} size={16} />}
      />
    </TableHeader>
  )
}

export default CarbonCopyHeader
