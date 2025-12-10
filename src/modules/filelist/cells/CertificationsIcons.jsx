import get from 'lodash/get'
import React from 'react'

import Icon from 'cozy-ui/transpiled/react/Icon'
import CarbonCopyIcon from 'cozy-ui/transpiled/react/Icons/CarbonCopy'
import AppIcon from 'cozy-ui-plus/dist/AppIcon'

import styles from '@/styles/filelist.styl'

const CertificationsIcons = ({ attributes }) => {
  const isCarbonCopy = get(attributes, 'metadata.carbonCopy')
  const isElectronicSafe = get(attributes, 'metadata.electronicSafe')
  const slug = get(attributes, 'cozyMetadata.uploadedBy.slug')

  return (
    <div className={styles['fil-file-certifications']}>
      {(isCarbonCopy || isElectronicSafe) && (
        <span className={styles['fil-file-certifications--separator']}>
          {' - '}
        </span>
      )}
      {isCarbonCopy &&
        (isElectronicSafe ? (
          <span data-testid="certificationsIcons-carbonCopyIcon">
            <Icon
              icon={CarbonCopyIcon}
              className={`u-mr-half ${styles['fil-file-certifications--icon']}`}
            />
          </span>
        ) : (
          <span data-testid="certificationsIcons-carbonCopyAppIcon">
            <AppIcon
              app={slug}
              className={styles['fil-file-certifications--icon']}
              type="konnector"
              priority="registry"
            />
          </span>
        ))}
      {isElectronicSafe && (
        <span data-testid="certificationsIcons-electronicSafeAppIcon">
          <AppIcon
            app={slug}
            className={styles['fil-file-certifications--icon']}
            type="konnector"
            priority="registry"
          />
        </span>
      )}
    </div>
  )
}

export default CertificationsIcons
