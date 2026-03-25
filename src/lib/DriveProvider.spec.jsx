import { render } from '@testing-library/react'
import React from 'react'

import SharingProvider from 'cozy-sharing'

import DriveProvider from './DriveProvider'

jest.mock('cozy-client', () => ({
  CozyProvider: ({ children }) => children
}))

jest.mock('cozy-dataproxy-lib', () => ({
  DataProxyProvider: ({ children }) => children
}))

jest.mock('cozy-keys-lib', () => ({
  VaultUnlockProvider: ({ children }) => children,
  VaultProvider: ({ children }) => children,
  VaultUnlockPlaceholder: () => null
}))

jest.mock('cozy-sharing', () => {
  const SharingProvider = jest.fn(({ children }) => children)
  SharingProvider.displayName = 'SharingProvider'
  return {
    __esModule: true,
    default: SharingProvider,
    NativeFileSharingProvider: ({ children }) => children
  }
})

jest.mock('cozy-ui/transpiled/react/providers/Alert', () => ({ children }) => children)
jest.mock('cozy-ui/transpiled/react/providers/Breakpoints', () => ({
  BreakpointsProvider: ({ children }) => children
}))
jest.mock('cozy-ui-plus/dist/providers/CozyTheme', () => ({ children }) => children)
jest.mock('twake-i18n', () => ({
  I18n: ({ children }) => children
}))

jest.mock('@/components/RightClick/RightClickProvider', () => ({ children }) => children)
jest.mock('@/lib/FabProvider', () => ({ children }) => children)

jest.mock('@/modules/public/PublicProvider', () => ({
  usePublicContext: jest.fn()
}))

const { usePublicContext } = require('@/modules/public/PublicProvider')

describe('DriveProvider', () => {
  const defaultProps = {
    client: {},
    lang: 'en',
    polyglot: {},
    dictRequire: jest.fn()
  }

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should pass isPublic=true to SharingProvider when in public context', () => {
    usePublicContext.mockReturnValue({ isPublic: true })

    render(
      <DriveProvider {...defaultProps}>
        <div>test</div>
      </DriveProvider>
    )

    expect(SharingProvider).toHaveBeenCalledWith(
      expect.objectContaining({ isPublic: true }),
      expect.anything()
    )
  })

  it('should pass isPublic=false to SharingProvider when not in public context', () => {
    usePublicContext.mockReturnValue({ isPublic: false })

    render(
      <DriveProvider {...defaultProps}>
        <div>test</div>
      </DriveProvider>
    )

    expect(SharingProvider).toHaveBeenCalledWith(
      expect.objectContaining({ isPublic: false }),
      expect.anything()
    )
  })
})
