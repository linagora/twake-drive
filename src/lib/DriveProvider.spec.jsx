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
  const React = require('react')
  const SharingProvider = jest.fn(({ children }) => children)
  SharingProvider.displayName = 'SharingProvider'
  const SharingContext = React.createContext()
  return {
    __esModule: true,
    default: SharingProvider,
    SharingContext,
    NativeFileSharingProvider: ({ children }) => children
  }
})

jest.mock(
  'cozy-ui/transpiled/react/providers/Alert',
  () =>
    ({ children }) =>
      children
)
jest.mock('cozy-ui/transpiled/react/providers/Breakpoints', () => ({
  BreakpointsProvider: ({ children }) => children
}))
jest.mock(
  'cozy-ui-plus/dist/providers/CozyTheme',
  () =>
    ({ children }) =>
      children
)
jest.mock('twake-i18n', () => ({
  I18n: ({ children }) => children
}))

jest.mock(
  '@/components/RightClick/RightClickProvider',
  () =>
    ({ children }) =>
      children
)
jest.mock(
  '@/lib/FabProvider',
  () =>
    ({ children }) =>
      children
)

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

  it('should not render SharingProvider on public pages to prevent io.cozy.sharings realtime subscriptions', () => {
    usePublicContext.mockReturnValue({ isPublic: true })

    render(
      <DriveProvider {...defaultProps}>
        <div>test</div>
      </DriveProvider>
    )

    expect(SharingProvider).not.toHaveBeenCalled()
  })

  it('should render SharingProvider with correct doctype on non-public pages', () => {
    usePublicContext.mockReturnValue({ isPublic: false })

    render(
      <DriveProvider {...defaultProps}>
        <div>test</div>
      </DriveProvider>
    )

    expect(SharingProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        doctype: 'io.cozy.files',
        documentType: 'Files'
      }),
      expect.anything()
    )
  })

  it('should still render children on public pages via SharingContext.Provider', () => {
    usePublicContext.mockReturnValue({ isPublic: true })

    const { getByText } = render(
      <DriveProvider {...defaultProps}>
        <div>public content</div>
      </DriveProvider>
    )

    expect(getByText('public content')).toBeTruthy()
  })
})
