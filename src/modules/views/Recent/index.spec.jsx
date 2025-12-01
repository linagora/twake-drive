import { render, fireEvent, act } from '@testing-library/react'
import React from 'react'

import { useSharingContext } from 'cozy-sharing'

import RecentViewWithProvider from './index'
import {
  generateFileFixtures,
  getByTextWithMarkup,
  removeNonASCII
} from '../testUtils'
import AppLike from 'test/components/AppLike'
import { setupStoreAndClient } from 'test/setup'

const mockNavigate = jest.fn()

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate
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

jest.mock('cozy-dataproxy-lib', () => ({
  useDataProxy: jest.fn()
}))

const mockUseDataProxy = require('cozy-dataproxy-lib').useDataProxy

useSharingContext.mockReturnValue({ byDocId: [] })

const setup = ({ nbFiles, path, dir_id, updated_at }) => {
  const { store, client } = setupStoreAndClient()

  client.plugins.realtime = {
    subscribe: jest.fn(),
    unsubscribe: jest.fn()
  }
  client.query = jest.fn().mockReturnValue({ data: [] })
  client.stackClient.fetchJSON = jest
    .fn()
    .mockReturnValue({ data: [], rows: [] })

  const filesFixture = generateFileFixtures({
    nbFiles,
    path,
    dir_id,
    updated_at
  })

  const filesWithPath = filesFixture.map(f => ({
    ...f,
    displayedPath: path
  }))

  // Mock useDataProxy to return a dataProxy object
  mockUseDataProxy.mockReturnValue({
    dataProxyServicesAvailable: true,
    recents: jest.fn().mockResolvedValue(filesWithPath)
  })

  const rendered = render(
    <AppLike client={client} store={store}>
      <RecentViewWithProvider />
    </AppLike>
  )
  return { ...rendered, client }
}

describe('Recent View', () => {
  it('tests the recent view', async () => {
    // TODO : Remove nested <a> on File when withFilePath is true
    jest.spyOn(console, 'error').mockImplementation()
    // TODO : Fix https://github.com/cozy/cozy-drive/issues/2913)
    jest.spyOn(console, 'warn').mockImplementation()
    const nbFiles = 2
    const path = '/test'
    const dir_id = '123'
    const updated_at = '2020-05-14T10:33:31.365224+02:00'

    const { getByText } = setup({
      nbFiles,
      path,
      dir_id,
      updated_at
    })
    const sleep = duration =>
      new Promise(resolve => setTimeout(resolve, duration))
    await act(async () => {
      await sleep(100)
    })
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
    expect(mockNavigate).toHaveBeenCalledWith('/file/file-foobar0/revision')
  })
})
