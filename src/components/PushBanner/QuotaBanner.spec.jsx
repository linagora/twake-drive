import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'

import { useInstanceInfo } from 'cozy-client'
import { isFlagshipApp } from 'cozy-device-helper'
import flag from 'cozy-flags'
import { useWebviewIntent } from 'cozy-intent'

import { usePushBannerContext } from './PushBannerProvider'
import QuotaBanner from './QuotaBanner'
import { TestI18n } from 'test/components/AppLike'

jest.mock('./PushBannerProvider', () => ({
  usePushBannerContext: jest.fn()
}))
jest.mock('cozy-device-helper', () => ({
  ...jest.requireActual('cozy-device-helper'),
  isFlagshipApp: jest.fn()
}))
jest.mock('cozy-flags')
jest.mock('cozy-client', () => ({
  ...jest.requireActual('cozy-client'),
  useInstanceInfo: jest.fn(() => ({
    isLoaded: true
  }))
}))
jest.mock('cozy-intent', () => ({
  ...jest.requireActual('cozy-intent'),
  useWebviewIntent: jest.fn()
}))

describe('QuotaBanner', () => {
  const dismissSpy = jest.fn()
  const openSpy = jest.spyOn(window, 'open').mockImplementation()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  const setup = ({
    enablePremiumLinks = false,
    hasUuid = false,
    isFlagshipApp: isFlagshipAppReturnValue = false,
    isIapEnabled = null,
    isIapAvailable = null
  } = {}) => {
    usePushBannerContext.mockReturnValue({
      dismissPushBanner: dismissSpy
    })

    useInstanceInfo.mockReturnValue({
      context: {
        data: {
          enable_premium_links: enablePremiumLinks,
          manager_url: 'http://mycozy.cloud'
        }
      },
      instance: {
        data: {
          uuid: hasUuid ? '123' : null
        }
      }
    })

    isFlagshipApp.mockReturnValue(isFlagshipAppReturnValue)
    flag.mockReturnValue(isIapEnabled)
    const mockCall = jest.fn().mockResolvedValue(isIapAvailable)
    useWebviewIntent.mockReturnValue({
      call: mockCall
    })

    render(
      <TestI18n>
        <QuotaBanner />
      </TestI18n>
    )
  }

  it('should display "I understand" button and close the banner', () => {
    setup()

    fireEvent.click(screen.getByRole('button', { name: 'I understand' }))
    expect(dismissSpy).toHaveBeenCalledTimes(1)

    const premiumButton = screen.queryByText('Check our plans')
    expect(premiumButton).toBeNull()
  })

  it('should hide premium link when there is a premium link but it is not enabled', () => {
    setup({
      hasUuid: true
    })

    const premiumButton = screen.queryByText('Check our plans')
    expect(premiumButton).toBeNull()
  })

  it('should display premium link when the premium link is enabled and available', () => {
    setup({
      hasUuid: true,
      enablePremiumLinks: true
    })

    fireEvent.click(screen.getByText('Check our plans'))
    expect(openSpy).toHaveBeenCalledWith(
      'http://mycozy.cloud/cozy/instances/123/premium?lang=en',
      '_self'
    )
  })

  it('should hide premium link when is on flagship application', () => {
    setup({
      hasUuid: true,
      enablePremiumLinks: true,
      isFlagshipApp: true
    })

    const premiumButton = screen.queryByText('Check our plans')
    expect(premiumButton).toBeNull()
  })

  it('should hide premium link when the flagship app has not IAP available with the flag flagship.iap.enabled is false', () => {
    setup({
      hasUuid: true,
      enablePremiumLinks: true,
      isFlagshipApp: true,
      isIapEnabled: false,
      isIapAvailable: false
    })

    const premiumButton = screen.queryByText('Check our plans')
    expect(premiumButton).toBeNull()
  })

  it('should hide premium link when the flagship app has not IAP available with the flag flagship.iap.enabled is true', () => {
    setup({
      hasUuid: true,
      enablePremiumLinks: true,
      isFlagshipApp: true,
      isIapEnabled: true,
      isIapAvailable: false
    })

    const premiumButton = screen.queryByText('Check our plans')
    expect(premiumButton).toBeNull()
  })

  it('should display premium link when the flagship app has IAP available with the flag flagship.iap.enabled is true', async () => {
    setup({
      hasUuid: true,
      enablePremiumLinks: true,
      isFlagshipApp: true,
      isIapEnabled: true,
      isIapAvailable: true
    })

    const actionButton = await screen.findByText('Check our plans')

    fireEvent.click(actionButton)
    expect(openSpy).toHaveBeenCalledWith(
      'http://mycozy.cloud/cozy/instances/123/premium?lang=en',
      '_self'
    )
  })
})
