/**
 * Setup utilities to be used in tests
 */

import { configure, render, act } from '@testing-library/react'
import React from 'react'

import CozyClient from 'cozy-client'

import { generateFile } from './generate'
import configureStore from '../src/store/configureStore'
import AppLike from 'test/components/AppLike'
import FolderContent from 'test/components/FolderContent'

configure({ testIdAttribute: 'data-testid' })

export const mockCozyClientRequestQuery = dir_id => {
  beforeEach(() => {
    const files = Array(10)
      .fill(null)
      .map((x, i) => generateFile({ i, dir_id }))
    const directories = Array(3)
      .fill(null)
      .map((x, i) => generateFile({ i, type: 'directory', dir_id }))
    jest
      .spyOn(CozyClient.prototype, 'requestQuery')
      .mockImplementation(queryDefinition => {
        if (queryDefinition.selector?.type === 'directory') {
          return Promise.resolve({
            data: directories
          })
        } else {
          return Promise.resolve({
            data: files
          })
        }
      })
  })

  afterEach(() => {
    CozyClient.prototype.requestQuery.mockRestore()
  })
}

export const setupStore = ({
  client,
  initialStoreState,
  setStoreToClient = true
} = {}) => {
  return configureStore({
    client,
    t: x => x,
    initialState: initialStoreState,
    logger: false,
    setStoreToClient
  })
}

export const setupStoreAndClient = ({ initialStoreState } = {}) => {
  const client = new CozyClient({
    useCustomStore: true
  })
  client.getStackClient().setUri('http://test.cloud')

  const store = setupStore({ client, initialStoreState })
  return { store, client }
}

/**
 * Helper function for tests
 *
 * - Mounts a FolderContent view with a client and the store of the app
 * - CozyClient::requestQuery needs to be mocked
 * - After mount, the store should have content in .cozy.queries
 */
const setupFolderContent = async ({ folderId, initialStoreState }) => {
  const { client, store } = setupStoreAndClient({
    initialStoreState
  })

  const sortOrder = {
    attribute: 'name',
    order: 'desc'
  }
  let root

  await act(async () => {
    root = render(
      <AppLike store={store} client={client}>
        <FolderContent folderId={folderId} sortOrder={sortOrder} />
      </AppLike>
    )
  })

  return { root, store, client }
}

export { setupFolderContent }
