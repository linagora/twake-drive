import { render, screen } from '@testing-library/react'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'

import { useInstanceInfo } from 'cozy-client'
import { makeDiskInfos } from 'cozy-client/dist/models/instance'
import { isFlagshipApp } from 'cozy-device-helper'

import PushBanner from '.'
import { usePushBannerContext } from './PushBannerProvider'

import { ROUTER_FUTURE_FLAGS } from '@/constants/config'

jest.mock('./QuotaBanner', () => () => <div>QuotaBanner</div>)

jest.mock('../pushClient/Banner', () => () => <div>BannerClient</div>)

jest.mock('cozy-client/dist/models/instance', () => ({
  makeDiskInfos: jest.fn()
}))

jest.mock('cozy-client', () => ({
  ...jest.requireActual('cozy-client'),
  useInstanceInfo: jest.fn(() => ({
    isLoaded: true
  }))
}))

jest.mock('./PushBannerProvider', () => ({
  usePushBannerContext: jest.fn(() => ({
    bannerDismissed: {}
  }))
}))

jest.mock('cozy-device-helper', () => ({
  isFlagshipApp: jest.fn(() => false)
}))

function renderAt(pathname = '/folder') {
  return render(
    <MemoryRouter future={ROUTER_FUTURE_FLAGS} initialEntries={[pathname]}>
      <PushBanner />
    </MemoryRouter>
  )
}

describe('PushBanner', () => {
  const setup = (percentUsage = 50, dismissed = false, pathname) => {
    usePushBannerContext.mockReturnValue({
      bannerDismissed: {
        quota: dismissed
      }
    })
    makeDiskInfos.mockReturnValue({
      percentUsage
    })
    return renderAt(pathname)
  }

  describe('QuotaBanner', () => {
    it('should show quota banner when disk usage has reach 80%', () => {
      setup(80)
      expect(screen.findByText('QuotaBanner')).toBeDefined()
    })

    it('should show client banner when disk usage is below 80%', () => {
      setup(50)
      expect(screen.findByText('BannerClient')).toBeDefined()
    })

    it('should show client banner when use dismiss it', () => {
      setup(90, true)
      expect(screen.findByText('BannerClient')).toBeDefined()
    })
  })

  describe('BannerClient', () => {
    it('should show client banner if the quota banner is not displayed', () => {
      setup(80)
      expect(screen.findByText('QuotaBanner')).toBeDefined()
    })

    it('should hide client banner on sharings pages', () => {
      isFlagshipApp.mockReturnValue(false)
      setup(50, false, '/sharings/with-me/folder/folder-id')
      expect(screen.queryByText('BannerClient')).toBe(null)
    })

    it('should keep the quota banner on sharings pages', () => {
      isFlagshipApp.mockReturnValue(false)
      setup(80, false, '/sharings/with-me')
      expect(screen.queryByText('QuotaBanner')).toBeInTheDocument()
    })

    it('should hide client banner on flagship app', () => {
      isFlagshipApp.mockReturnValue(true)
      const { container } = setup()
      expect(container).toBeEmptyDOMElement()
    })

    it('should hide client banner in the embedded space', () => {
      isFlagshipApp.mockReturnValue(false)
      const { container } = setup(
        50,
        false,
        '/embed/sharings/drive-id/folder-id'
      )
      expect(container).toBeEmptyDOMElement()
    })
  })

  it('should hide banner when the instance information is not loaded', () => {
    useInstanceInfo.mockReturnValue({
      isLoaded: false
    })
    const { container } = renderAt()
    expect(container).toBeEmptyDOMElement()
  })
})
