import { render, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import { Route, Routes } from 'react-router-dom'

import { useQuery } from 'cozy-client'
import flag from 'cozy-flags'

import { SharingsView } from './index'
import { SharingsTabProvider } from './useSharingsTab'
import {
  generateFileFixtures,
  getByTextWithMarkup,
  removeNonASCII
} from '../testUtils'
import AppLike from 'test/components/AppLike'
import { setupStoreAndClient } from 'test/setup'

import {
  SHARING_TAB_BY_ME,
  SHARING_TAB_DRIVES,
  SHARING_TAB_WITH_ME
} from '@/constants/config'

const mockSharingContext = jest.fn()

jest.mock('cozy-sharing', () => ({
  __esModule: true,
  ...jest.requireActual('cozy-sharing'),
  useSharingContext: () => mockSharingContext()
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
jest.mock('cozy-flags', () => ({
  __esModule: true,
  default: jest.fn(() => false)
}))
jest.mock('cozy-client/dist/utils', () => ({
  ...jest.requireActual('cozy-client/dist/utils'),
  hasQueryBeenLoaded: jest.fn().mockReturnValue(true)
}))
jest.mock('components/useHead', () => jest.fn())

const SharingsRoute = ({ tab }) => (
  <SharingsTabProvider tab={tab}>
    <SharingsView />
  </SharingsTabProvider>
)

const setup = ({
  initialTab = SHARING_TAB_WITH_ME,
  sharedDrives = []
} = {}) => {
  const { store, client } = setupStoreAndClient()
  window.location.hash = `#/sharings/${initialTab}`

  client.plugins.realtime = {
    subscribe: jest.fn(),
    unsubscribe: jest.fn()
  }
  client.query = jest.fn().mockReturnValue({ data: [] })
  client.stackClient.fetchJSON = jest
    .fn()
    .mockImplementation((method, route) =>
      route === '/sharings/drives'
        ? { data: sharedDrives }
        : { data: [], rows: [] }
    )

  const rendered = render(
    <AppLike client={client} store={store}>
      <Routes>
        <Route
          path="/sharings/with-me"
          element={<SharingsRoute tab={SHARING_TAB_WITH_ME} />}
        />
        <Route
          path="/sharings/by-me"
          element={<SharingsRoute tab={SHARING_TAB_BY_ME} />}
        />
        <Route
          path="/sharings/drives"
          element={<SharingsRoute tab={SHARING_TAB_DRIVES} />}
        />
      </Routes>
    </AppLike>
  )
  return { ...rendered, client }
}

describe('Sharings View', () => {
  const nbFiles = 2
  const path = '/test'
  const dir_id = 'dirIdParent'
  const updated_at = '2020-05-14T10:33:31.365224+02:00'

  const filesFixture = generateFileFixtures({
    nbFiles,
    path,
    dir_id,
    updated_at
  })

  const filesFixtureWithPath = {
    data: filesFixture.map(f => {
      return {
        ...f,
        displayedPath: path
      }
    })
  }

  beforeAll(() => {
    // TODO : Remove nested <a> on File when withFilePath is true
    jest.spyOn(console, 'error').mockImplementation()
  })

  beforeEach(() => {
    flag.mockImplementation(() => false)
    // isOwner is consumed by useFilteredSharings to classify entries into
    // tabs; false files every fixture under the default with-me tab.
    mockSharingContext.mockReturnValue({
      byDocId: [],
      allLoaded: true,
      isOwner: () => false
    })
  })

  afterEach(() => {
    window.location.hash = ''
  })

  afterAll(() => {
    jest.clearAllMocks()
  })

  it('should display placeholder when all files are not loaded', async () => {
    mockSharingContext.mockReturnValue({
      byDocId: [],
      allLoaded: false,
      isOwner: () => false
    })
    const { container } = setup()

    await waitFor(() => {
      expect(
        container.querySelector('.fil-content-file-placeholder')
      ).not.toBeNull()
    })
  })

  it('should not display placeholder when all files are loaded', async () => {
    useQuery.mockReturnValue(filesFixtureWithPath)

    const { container } = setup()

    await waitFor(() => {
      expect(
        container.querySelector('.fil-content-file-placeholder')
      ).toBeNull()
    })
  })

  it('tests the sharings view', async () => {
    // TODO : Fix https://github.com/cozy/cozy-drive/issues/2913
    jest.spyOn(console, 'warn').mockImplementation()

    useQuery.mockReturnValue(filesFixtureWithPath)

    const { getByText } = setup()

    await waitFor(() => {
      // Get the HTMLElement containing the filename if exist. If not throw
      const el0 = getByText(`foobar0`)
      // Check if the filename is displayed with the extension. If not throw
      getByTextWithMarkup(getByText, `foobar0.pdf`)
      // get the FileRow element
      const fileRow0 = el0.closest('.fil-content-row')
      // check if the date is right
      expect(fileRow0.getElementsByTagName('time')[0].dateTime).toEqual(
        updated_at
      )
      // check the path to the parent's folder
      const linkElement0 = fileRow0.getElementsByClassName('fil-file-path')[0]
      expect(removeNonASCII(linkElement0.textContent)).toEqual(path)

      expect(linkElement0.href.endsWith(`#/folder/${dir_id}`)).toBe(true)

      // check if the ActionMenu is displayed
      fireEvent.click(fileRow0.getElementsByTagName('button')[0])
      const el1 = getByText(`foobar1`)
      const parentDiv1 = el1.closest('.fil-file')
      expect(
        removeNonASCII(
          parentDiv1.getElementsByClassName('fil-file-path')[0].textContent
        )
      ).toEqual(path)

      // navigates  to the history view
      const historyItem = getByText('History')
      fireEvent.click(historyItem)
    })

    expect(window.location.hash).toBe(
      '#/sharings/with-me/file/file-foobar0/revision'
    )
  })

  it('filters the list by the active tab and swaps it on tab switch', async () => {
    useQuery.mockReturnValue(filesFixtureWithPath)
    mockSharingContext.mockReturnValue({
      byDocId: [],
      allLoaded: true,
      isOwner: id => id === 'file-foobar0'
    })

    const { getByText, queryByText, getByRole } = setup()

    // Default with-me tab: only the file shared by someone else is listed.
    await waitFor(() => {
      expect(getByText('foobar1')).toBeInTheDocument()
    })
    expect(queryByText('foobar0')).toBeNull()

    // Switching to the by-me tab swaps the list to the owned file.
    fireEvent.click(getByRole('tab', { name: 'By me' }))

    await waitFor(() => {
      expect(getByText('foobar0')).toBeInTheDocument()
    })
    expect(queryByText('foobar1')).toBeNull()
  })

  describe('team drives tab visibility', () => {
    const orgDriveSharing = {
      id: 'sharing-org',
      _id: 'sharing-org',
      org_drive: true,
      rules: [{ title: 'Org Drive', values: ['folder-org'] }]
    }

    beforeEach(() => {
      flag.mockImplementation(name => name === 'drive.shared-drive.enabled')
    })

    it('hides the team drives tab when there are no org drives', async () => {
      useQuery.mockReturnValue(filesFixtureWithPath)

      const { getByRole, queryByRole } = setup()

      await waitFor(() => {
        expect(getByRole('tab', { name: 'With me' })).toBeInTheDocument()
      })
      expect(queryByRole('tab', { name: 'Team drives' })).toBeNull()
    })

    it('shows the team drives tab once an org drive exists', async () => {
      useQuery.mockReturnValue(filesFixtureWithPath)

      const { getByRole } = setup({ sharedDrives: [orgDriveSharing] })

      await waitFor(() => {
        expect(getByRole('tab', { name: 'Team drives' })).toBeInTheDocument()
      })
    })

    it('canonicalizes an empty drives deep link to the with-me tab', async () => {
      useQuery.mockReturnValue(filesFixtureWithPath)

      const { getByRole, queryByRole } = setup({
        initialTab: SHARING_TAB_DRIVES
      })

      await waitFor(() => {
        expect(getByRole('tab', { name: 'With me' })).toHaveAttribute(
          'aria-selected',
          'true'
        )
      })
      expect(queryByRole('tab', { name: 'Team drives' })).toBeNull()
      expect(window.location.hash).toBe('#/sharings/with-me')
    })
  })
})
