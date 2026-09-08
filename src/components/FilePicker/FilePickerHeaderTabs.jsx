import {
  ClockOutline,
  Cloud2,
  Icon,
  ShareExternal
} from '@linagora/twake-icons'
import cx from 'classnames'
import PropTypes from 'prop-types'
import React from 'react'

import Tab from 'cozy-ui/transpiled/react/Tab'
import Tabs from 'cozy-ui/transpiled/react/Tabs'
import { useI18n } from 'twake-i18n'

import styles from './FilePickerHeaderTabs.styl'
import { filePickerSections } from './constants'

const navigationItems = [
  {
    icon: Cloud2,
    labelKey: 'Nav.item_drive',
    value: filePickerSections.DRIVE
  },
  {
    icon: ClockOutline,
    labelKey: 'Nav.item_recent',
    value: filePickerSections.RECENTS
  },
  {
    icon: ShareExternal,
    labelKey: 'Nav.item_sharings',
    value: filePickerSections.SHARINGS
  }
]

export const FilePickerHeaderTabs = ({
  activeSection,
  availableSections,
  onSectionChange
}) => {
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
      {navigationItems
        .filter(item => availableSections.includes(item.value))
        .map(item => (
          <Tab
            key={item.value}
            value={item.value}
            label={
              <span className="u-flex u-flex-items-center">
                <Icon icon={item.icon} size="16" className="u-mr-half" />
                {t(item.labelKey)}
              </span>
            }
            className={cx(
              styles.filePickerNavigationTab,
              'u-pv-half u-ph-half'
            )}
          />
        ))}
    </Tabs>
  )
}

FilePickerHeaderTabs.propTypes = {
  activeSection: PropTypes.oneOf(Object.values(filePickerSections)).isRequired,
  availableSections: PropTypes.arrayOf(
    PropTypes.oneOf(Object.values(filePickerSections))
  ).isRequired,
  onSectionChange: PropTypes.func.isRequired
}

FilePickerHeaderTabs.defaultProps = {
  availableSections: Object.values(filePickerSections)
}
