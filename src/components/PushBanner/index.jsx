import React from 'react'
import { useLocation } from 'react-router-dom'

import { useInstanceInfo } from 'cozy-client'
import { makeDiskInfos } from 'cozy-client/dist/models/instance'
import { isFlagshipApp } from 'cozy-device-helper'

import { usePushBannerContext } from './PushBannerProvider'
import QuotaBanner from './QuotaBanner'
import BannerClient from '../../components/pushClient/Banner'

import { SHARINGS_VIEW_ROUTE } from '@/constants/config'
import { isSpacePath } from '@/modules/routeUtils'

/**
 * Component to manage all banner display logic
 */
const PushBanner = () => {
  const { bannerDismissed } = usePushBannerContext()
  const { isLoaded, diskUsage } = useInstanceInfo()
  const { pathname } = useLocation()

  if (!isLoaded) return null

  const diskInfos = makeDiskInfos(
    diskUsage?.data?.attributes?.used,
    diskUsage?.data?.attributes?.quota
  )

  if (!bannerDismissed.quota && diskInfos.percentUsage >= 80) {
    return <QuotaBanner />
  }

  if (
    !isFlagshipApp() &&
    !pathname.startsWith(SHARINGS_VIEW_ROUTE) &&
    !isSpacePath(pathname)
  ) {
    return <BannerClient />
  }

  return null
}

export default PushBanner
