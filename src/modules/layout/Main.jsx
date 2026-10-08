import cx from 'classnames'
import PropTypes from 'prop-types'
import React from 'react'

import { RealTimeQueries } from 'cozy-client'
import flag from 'cozy-flags'
import { Main as MainUI } from 'cozy-ui/transpiled/react/Layout'

import styles from './main.styl'

import { MigrationProgressBanner } from '@/components/Migration/MigrationProgressBanner'
import PushBanner from '@/components/PushBanner'
import { NEXTCLOUD_MIGRATIONS_DOCTYPE } from '@/lib/doctypes'
import SharingInvitations from '@/modules/views/Sharings/SharingInvitations'

const Main = ({ children, isPublic = false }) => (
  <MainUI>
    {!isPublic && (
      <>
        {flag('settings.migration.enabled') && (
          <RealTimeQueries doctype={NEXTCLOUD_MIGRATIONS_DOCTYPE} />
        )}
        <div className={cx(styles.banners, 'u-mt-1 u-mt-0-m')}>
          <PushBanner />
          {flag('settings.migration.enabled') && <MigrationProgressBanner />}
          <SharingInvitations />
        </div>
      </>
    )}
    {children}
  </MainUI>
)

Main.propTypes = {
  isPublic: PropTypes.bool,
  children: PropTypes.array
}
export default Main
