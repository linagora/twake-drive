import { render } from '@testing-library/react'
import React from 'react'

import { useSharingContext } from 'cozy-sharing'

import RecentViewWithProvider from './index'
import { generateFileFixtures } from '../testUtils'
import AppLike from 'test/components/AppLike'
import { setupStoreAndClient } from 'test/setup'

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn()
}))

jest.mock('components/pushClient', () => ({
  isMacOS: jest.fn(() => false),
  isIOS: jest.fn(() => false),
  isLinux: jest.fn(() => false),
  isAndroid: jest.fn(() => false)
}))
jest.mock('components/pushClient/Banner', () => () => <div>Banner</div>)
jest.mock('cozy-client/dist/hooks/useQuery', () =>
  jest.fn(() => ({
    fetchStatus: '',
    data: []
  }))
)
jest.mock('cozy-keys-lib', () => ({
  useVaultClient: jest.fn()
}))
jest.mock('components/useHead', () => jest.fn())
jest.mock('cozy-sharing', () => ({
  __esModule: true,
  ...jest.requireActual('cozy-sharing'),
  useSharingContext: jest.fn()
}))
jest.mock('@/hooks/useRecentFiles', () => ({
  __esModule: true,
  default: jest.fn()
}))

const mockUseRecentFiles = require('@/hooks/useRecentFiles').default

useSharingContext.mockReturnValue({ byDocId: [] })

const renderRecentView = recentsResult => {
  const { store, client } = setupStoreAndClient()
  client.plugins.realtime = { subscribe: jest.fn(), unsubscribe: jest.fn() }
  client.query = jest.fn().mockReturnValue({ data: [] })
  client.stackClient.fetchJSON = jest
    .fn()
    .mockReturnValue({ data: [], rows: [] })

  mockUseRecentFiles.mockReturnValue({
    scopeQueries: [],
    ...recentsResult
  })

  return render(
    <AppLike client={client} store={store}>
      <RecentViewWithProvider />
    </AppLike>
  )
}

const someFiles = () =>
  generateFileFixtures({
    nbFiles: 2,
    path: '/test',
    dir_id: '123',
    updated_at: '2020-05-14T10:33:31.365224+02:00'
  }).map(f => ({ ...f, displayedPath: '/test' }))

describe('Recent View loading indicator', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation()
    jest.spyOn(console, 'warn').mockImplementation()
  })

  it('shows a progress bar while shared-drive files are still loading and local files are already displayed', () => {
    const { queryByRole } = renderRecentView({
      data: someFiles(),
      fetchStatus: 'loading',
      error: null
    })

    expect(queryByRole('progressbar')).not.toBeNull()
  })

  it('hides the progress bar once everything is loaded', () => {
    const { queryByRole } = renderRecentView({
      data: someFiles(),
      fetchStatus: 'loaded',
      error: null
    })

    expect(queryByRole('progressbar')).toBeNull()
  })

  it('does not show the progress bar while loading with no list yet (the skeleton covers that case)', () => {
    const { queryByRole } = renderRecentView({
      data: [],
      fetchStatus: 'loading',
      error: null
    })

    expect(queryByRole('progressbar')).toBeNull()
  })
})
