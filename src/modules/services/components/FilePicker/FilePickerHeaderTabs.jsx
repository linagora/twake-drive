import { Cloud2, Icon, ShareExternal } from '@linagora/twake-icons'
import cx from 'classnames'
import PropTypes from 'prop-types'
import React from 'react'

import Tab from 'cozy-ui/transpiled/react/Tab'
import Tabs from 'cozy-ui/transpiled/react/Tabs'
import { useI18n } from 'twake-i18n'

import { filePickerSections } from './constants'
import styles from './styles.styl'

const navigationItems = [
  {
    icon: Cloud2,
    labelKey: 'Nav.item_drive',
    value: filePickerSections.DRIVE
  },
  {
    icon: ShareExternal,
    labelKey: 'Nav.item_sharings',
    value: filePickerSections.SHARINGS
  }
]

const FilePickerHeaderTabs = ({ activeSection, onSectionChange }) => {
  const { t } = useI18n()

  const handleSectionChange = (_, section) => {
    if (section !== null && section !== activeSection) {
      onSectionChange(section)
    }
  }

  return (
    <Tabs
      value={activeSection}
      onChange={handleSectionChange}
      aria-label={t('Nav.item_file_picker')}
      className={cx(
        styles.filePickerNavigation,
        'u-flex-self-start u-mt-half u-w-auto'
      )}
      narrowed
      textColor="primary"
      indicatorColor="primary"
    >
      {navigationItems.map(item => (
        <Tab
          key={item.value}
          value={item.value}
          label={
            <span className="u-flex u-flex-items-center">
              <Icon icon={item.icon} size="16" className="u-mr-half" />
              {t(item.labelKey)}
            </span>
          }
          className={cx(styles.filePickerNavigationTab, 'u-pv-half u-ph-half')}
        />
      ))}
    </Tabs>
  )
}

FilePickerHeaderTabs.propTypes = {
  activeSection: PropTypes.oneOf(Object.values(filePickerSections)).isRequired,
  onSectionChange: PropTypes.func.isRequired
}

export default FilePickerHeaderTabs
