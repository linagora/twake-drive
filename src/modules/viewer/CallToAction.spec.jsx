import { render, waitFor } from '@testing-library/react'
import localforage from 'localforage'
import React from 'react'

import CallToAction from './CallToAction'

import { NOVIEWER_DESKTOP_CTA } from '@/components/pushClient'

jest.mock('localforage')
jest.mock('config/config.json', () => ({
  promoteDesktop: { isActivated: true }
}))
jest.mock('components/pushClient', () => ({
  getDesktopAppDownloadLink: jest.fn().mockReturnValue('https://twake.app'),
  isClientAlreadyInstalled: jest.fn().mockResolvedValueOnce(false),
  isLinux: jest.fn(),
  NOVIEWER_DESKTOP_CTA: 'noviewer_desktop_cta'
}))

describe('CallToAction', () => {
  it('should get item noviewer desktop from localforage', async () => {
    // Given
    localforage.getItem = jest.fn().mockResolvedValueOnce(false)

    // When
    await waitFor(async () => {
      render(<CallToAction t={jest.fn()} />)
    })

    // Then
    expect(localforage.getItem).toHaveBeenCalledWith(NOVIEWER_DESKTOP_CTA)
  })

  it('should use rel="noreferrer" (which implies rel="noopener", because it is a security risk', async () => {
    // Given
    localforage.getItem = jest.fn().mockResolvedValueOnce(false)

    // When
    let container
    await waitFor(async () => {
      const result = render(<CallToAction t={jest.fn()} />)
      container = result.container
    })

    // Then
    expect(container.querySelector('a[target="_blank"]')).toHaveAttribute(
      'rel',
      'noreferrer'
    )
  })
})
