import PropTypes from 'prop-types'
import React from 'react'

import { RealTimeQueries } from 'cozy-client'
import { Main as MainUI } from 'cozy-ui/transpiled/react/Layout'

import { MigrationProgressBanner } from '@/components/Migration/MigrationProgressBanner'
import PushBanner from '@/components/PushBanner'
import { NEXTCLOUD_MIGRATIONS_DOCTYPE } from '@/lib/doctypes'

const Main = ({ children, isPublic = false }) => (
  <MainUI>
    <PushBanner isPublic={isPublic} />
    {!isPublic && (
      <>
        <RealTimeQueries doctype={NEXTCLOUD_MIGRATIONS_DOCTYPE} />
        <MigrationProgressBanner />
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
