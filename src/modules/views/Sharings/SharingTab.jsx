import cx from 'classnames'
import React from 'react'
import { useI18n } from 'twake-i18n'

import Icon from 'cozy-ui/transpiled/react/Icon'
import FileTypeFolderIcon from 'cozy-ui/transpiled/react/Icons/FileTypeFolder'
import FileTypeSharedDriveIcon from 'cozy-ui/transpiled/react/Icons/FileTypeSharedDriveGrey'
import Tab from 'cozy-ui/transpiled/react/Tab'
import Tabs from 'cozy-ui/transpiled/react/Tabs'
import ToggleButton from 'cozy-ui/transpiled/react/ToggleButton'
import ToggleButtonGroup from 'cozy-ui/transpiled/react/ToggleButtonGroup'
import Typography from 'cozy-ui/transpiled/react/Typography'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'

import styles from '@/styles/topbar.styl'

const SharingTab = ({ tab, setTab }) => {
  const tabItems = ['sharings_tab_all', 'sharings_tab_drives']
  const { isMobile } = useBreakpoints()
  const { t } = useI18n()

  const handleChange = (_, newValue) => {
    setTab(newValue)
  }

  return (
    <>
      {isMobile ? (
        <Tabs
          indicatorColor="primary"
          textColor="primary"
          value={tab}
          narrowed
          onChange={handleChange}
        >
          {tabItems.map(tabItem => (
            <Tab key={tabItem} label={t(`toolbar.${tabItem}`)} />
          ))}
        </Tabs>
      ) : (
        <ToggleButtonGroup
          variant="rounded"
          value={tab}
          exclusive
          onChange={handleChange}
          className={cx('u-mb-1-half', styles['fil-topbar'])}
        >
          {tabItems.map((tabItem, index) => (
            <ToggleButton
              key={tabItem}
              value={index}
              rounded
              className={cx(styles['fil-tab-item'], 'u-ml-0', {
                [styles['fil-tab-item--selected']]: index === tab
              })}
            >
              <Icon
                icon={
                  tabItem === 'sharings_tab_all'
                    ? FileTypeFolderIcon
                    : FileTypeSharedDriveIcon
                }
                className={cx(styles['fil-tab-icon'], 'u-mr-1')}
              />
              <Typography className={cx(styles['fil-tab-name'])}>
                {t(`toolbar.${tabItem}`)}
              </Typography>
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      )}
    </>
  )
}

export default SharingTab
