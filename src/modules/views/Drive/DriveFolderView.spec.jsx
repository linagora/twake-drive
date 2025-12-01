import { act, render } from '@testing-library/react'
import React from 'react'

import AppLike from 'test/components/AppLike'
import { setupStoreAndClient } from 'test/setup'

import AppRoute from '@/modules/navigation/AppRoute'

jest.mock('cozy-harvest-lib', () => ({
  LaunchTriggerCard: jest.fn()
}))
jest.mock('modules/views/Drive/useTrashRedirect', () => ({
  useTrashRedirect: jest.fn()
}))

// eslint-disable-next-line react/display-name
jest.mock('../../upload/Dropzone', () => ({ children }) => (
  <div>{children}</div>
))

jest.mock('../Folder/FolderViewBreadcrumb', () =>
  // eslint-disable-next-line react/display-name
  ({ rootBreadcrumbPath, currentFolderId }) => (
    <div
      data-path={rootBreadcrumbPath}
      data-folder-id={currentFolderId}
      data-testid="FolderViewBreadcrumb"
    />
  )
)

jest.mock('hooks', () => ({
  useCurrentFolderId: jest.fn().mockReturnValue('1234'),
  useDisplayedFolder: jest.fn().mockReturnValue('5678'),
  useFolderSort: jest.fn(() => [{ attribute: 'name', order: 'asc' }, jest.fn()])
}))

jest.mock('modules/shareddrives/hooks/useSharedDrives', () => ({
  useSharedDrives: jest.fn().mockReturnValue([])
}))

jest.mock('cozy-keys-lib', () => ({
  useVaultClient: jest.fn()
}))

jest.mock('components/useHead', () => jest.fn())

describe('Drive View', () => {
  const setup = () => {
    const { store, client } = setupStoreAndClient()
    client.plugins.realtime = {
      subscribe: jest.fn(),
      unsubscribe: jest.fn()
    }
    client.query = jest.fn().mockReturnValue({ data: [] })
    client.fetchQueryAndGetFromState = jest.fn().mockReturnValue({ data: [] })
    const rendered = render(
      <AppLike client={client} store={store}>
        <AppRoute />
      </AppLike>
    )
    return { ...rendered, client }
  }

  it('should use FolderViewBreadcrumb with correct rootBreadcrumbPath', async () => {
    let render

    await act(async () => {
      render = await setup()
    })

    const { getByTestId } = render
    expect(getByTestId('FolderViewBreadcrumb')).toBeTruthy()
    expect(
      getByTestId('FolderViewBreadcrumb').hasAttribute('data-path')
    ).toEqual(true)
    expect(
      getByTestId('FolderViewBreadcrumb').getAttribute('data-folder-id')
    ).toEqual('1234')
  })
})
