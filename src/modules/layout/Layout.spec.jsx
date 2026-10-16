import { render, screen } from '@testing-library/react'
import React from 'react'
import { createStore } from 'redux'

import { createMockClient } from 'cozy-client'
import flag from 'cozy-flags'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'

import Layout from './Layout'
import AppLike from 'test/components/AppLike'

jest.mock('cozy-flags', () => jest.fn())
jest.mock('cozy-bar', () => ({
  BarComponent: () => <div data-testid="bar-component" />
}))
jest.mock('cozy-devtools', () => () => null)
jest.mock('cozy-flags/dist/FlagSwitcher', () => () => null)
jest.mock('cozy-ui-plus/dist/Storage', () => () => null)
jest.mock('@/components/pushClient/Button', () => () => null)
jest.mock('@/components/FilesRealTimeQueries', () => () => null)
jest.mock('@/modules/navigation/Nav', () => () => <nav data-testid="nav" />)
jest.mock('@/modules/upload/UploadButton', () => ({
  UploadButton: () => null
}))
jest.mock('@/modules/upload/UploadQueue', () => () => null)
jest.mock('@/hooks', () => ({
  useDisplayedFolder: () => ({ displayedFolder: null })
}))
jest.mock('@/modules/navigation/duck/reducer', () => ({
  wasOperationRedirected: () => false,
  RESET_OPERATION_REDIRECTED: 'RESET_OPERATION_REDIRECTED'
}))
jest.mock('cozy-ui/transpiled/react/providers/Breakpoints', () => {
  const actual = jest.requireActual(
    'cozy-ui/transpiled/react/providers/Breakpoints'
  )
  return {
    ...actual,
    __esModule: true,
    default: jest.fn()
  }
})

describe('Layout demo navigation buttons', () => {
  const store = createStore(() => ({
    navigation: { operationRedirected: false }
  }))
  const client = createMockClient({ store })
  client.store = store

  beforeEach(() => {
    useBreakpoints.mockReturnValue({ isDesktop: true, isMobile: false })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('renders neither demo button when both feature flags are disabled', () => {
    flag.mockImplementation(name => {
      if (name === 'drive.file-picker-demo.enabled') return false
      if (name === 'drive.move-intent-demo.enabled') return false
      return false
    })

    render(
      <AppLike client={client} store={store}>
        <Layout />
      </AppLike>
    )

    expect(
      screen.queryByRole('link', { name: 'File Picker intent demo' })
    ).toBe(null)
    expect(screen.queryByRole('link', { name: 'MOVE intent demo' })).toBe(null)
  })

  it('renders only the File Picker demo button when only its flag is enabled', () => {
    flag.mockImplementation(name => {
      if (name === 'drive.file-picker-demo.enabled') return true
      if (name === 'drive.move-intent-demo.enabled') return false
      return false
    })

    render(
      <AppLike client={client} store={store}>
        <Layout />
      </AppLike>
    )

    const filePickerLink = screen.getByRole('link', {
      name: 'File Picker intent demo'
    })
    expect(filePickerLink).toBeInTheDocument()
    expect(filePickerLink).toHaveAttribute('href', '#/file-picker-demo')
    expect(screen.queryByRole('link', { name: 'MOVE intent demo' })).toBe(null)
  })

  it('renders only the MOVE demo button when only its flag is enabled', () => {
    flag.mockImplementation(name => {
      if (name === 'drive.file-picker-demo.enabled') return false
      if (name === 'drive.move-intent-demo.enabled') return true
      return false
    })

    render(
      <AppLike client={client} store={store}>
        <Layout />
      </AppLike>
    )

    const moveLink = screen.getByRole('link', { name: 'MOVE intent demo' })
    expect(moveLink).toBeInTheDocument()
    expect(moveLink).toHaveAttribute('href', '#/move-intent-demo')
    expect(
      screen.queryByRole('link', { name: 'File Picker intent demo' })
    ).toBe(null)
  })

  it('renders both demo buttons when both flags are enabled', () => {
    flag.mockImplementation(name => {
      if (name === 'drive.file-picker-demo.enabled') return true
      if (name === 'drive.move-intent-demo.enabled') return true
      return false
    })

    render(
      <AppLike client={client} store={store}>
        <Layout />
      </AppLike>
    )

    const filePickerLink = screen.getByRole('link', {
      name: 'File Picker intent demo'
    })
    const moveLink = screen.getByRole('link', { name: 'MOVE intent demo' })

    expect(filePickerLink).toBeInTheDocument()
    expect(filePickerLink).toHaveAttribute('href', '#/file-picker-demo')
    expect(moveLink).toBeInTheDocument()
    expect(moveLink).toHaveAttribute('href', '#/move-intent-demo')
  })

  it('does not render desktop sidebar demo buttons on mobile viewport', () => {
    useBreakpoints.mockReturnValue({ isDesktop: false, isMobile: true })
    flag.mockImplementation(name => {
      if (name === 'drive.file-picker-demo.enabled') return true
      if (name === 'drive.move-intent-demo.enabled') return true
      return false
    })

    render(
      <AppLike client={client} store={store}>
        <Layout />
      </AppLike>
    )

    expect(
      screen.queryByRole('link', { name: 'File Picker intent demo' })
    ).toBe(null)
    expect(screen.queryByRole('link', { name: 'MOVE intent demo' })).toBe(null)
  })
})
