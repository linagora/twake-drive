import cx from 'classnames'
import get from 'lodash/get'
import React from 'react'
import { useI18n } from 'twake-i18n'

import Icon from 'cozy-ui/transpiled/react/Icon'
import CheckIcon from 'cozy-ui/transpiled/react/Icons/Check'
import { TableCell } from 'cozy-ui/transpiled/react/deprecated/Table'
import AppIcon from 'cozy-ui-plus/dist/AppIcon'

import styles from '@/styles/filelist.styl'

import CertificationTooltip from '@/modules/certifications/CertificationTooltip'

const CarbonCopyIcon = ({ file }) => {
  const hasElectronicSafe = get(file, 'metadata.electronicSafe')
  const konnectorName = get(file, 'cozyMetadata.uploadedBy.slug')

  if (hasElectronicSafe) {
    return <Icon icon={CheckIcon} />
  }
  return <AppIcon app={konnectorName} type="konnector" />
}

const CarbonCopy = ({ file }) => {
  const { t } = useI18n()
  const hasDataToshow = get(file, 'metadata.carbonCopy')

  return (
    <TableCell
      className={cx(styles['fil-content-cell'], styles['fil-content-narrow'])}
    >
      {hasDataToshow ? (
        <CertificationTooltip
          body={t('table.tooltip.carbonCopy.title')}
          caption={t('table.tooltip.carbonCopy.caption')}
          content={<CarbonCopyIcon file={file} />}
        />
      ) : (
        '—'
      )}
    </TableCell>
  )
}

export default CarbonCopy
