import { render, waitFor } from '@testing-library/react'
import React from 'react'

import { useAppLinkWithStoreFallback } from 'cozy-client'
import flag from 'cozy-flags'

import AddMenuContent from './AddMenuContent'
import AppLike from 'test/components/AppLike'
import { setupFolderContent, mockCozyClientRequestQuery } from 'test/setup'

import { ScannerProvider } from '@/modules/drive/Toolbar/components/Scanner/ScannerProvider'

jest.mock('cozy-client/dist/hooks/useAppLinkWithStoreFallback', () => jest.fn())
jest.mock('cozy-keys-lib', () => ({
  useVaultClient: jest.fn()
}))
jest.mock('cozy-flags')
mockCozyClientRequestQuery()

const setup = async (
  { folderId = 'directory-foobar0' } = {},
  {
    isUploadDisabled = false,
    canCreateFolder = false,
    canUpload = true,
    refreshFolderContent = true,
    isPublic = false,
    isReadOnly = false
  } = {}
) => {
  const { client, store } = await setupFolderContent({
    folderId
  })

  const displayedFolder = folderId ? { id: folderId } : folderId

  client.stackClient.uri = 'http://cozy.localhost'

  const root = render(
    <AppLike client={client} store={store}>
      <ScannerProvider displayedFolder={displayedFolder}>
        <AddMenuContent
          isUploadDisabled={isUploadDisabled}
          canCreateFolder={canCreateFolder}
          canUpload={canUpload}
          refreshFolderContent={refreshFolderContent}
          isPublic={isPublic}
          displayedFolder={displayedFolder}
          onClick={() => {}}
          isReadOnly={isReadOnly}
        />
      </ScannerProvider>
    </AppLike>
  )
  return { root }
}

describe('AddMenuContent', () => {
  describe('Menu', () => {
    beforeAll(() => {
      useAppLinkWithStoreFallback.mockReturnValue({
        fetchStatus: 'loaded',
        isInstalled: true
      })
    })

    const expectMenuItem = async (label, present, options) => {
      await waitFor(async () => {
        const { root } = await setup({ folderId: 'directory-foobar0' }, options)
        const node = root.queryByText(label)
        if (present) expect(node).toBeTruthy()
        else expect(node).toBeNull()
      })
    }

    it.each([
      {
        desc: 'does not display createNote on public Page',
        present: false,
        options: { isPublic: true }
      },
      {
        desc: 'displays createNote on private Page',
        present: true,
        options: { isPublic: false }
      }
    ])('$desc', ({ present, options }) =>
      expectMenuItem('Note', present, options)
    )

    describe('createExcalidraw', () => {
      beforeEach(() => {
        flag.mockImplementation(name => name === 'drive.excalidraw.enabled')
      })
      afterEach(() => {
        flag.mockReset()
      })

      it.each([
        {
          desc: 'displays createExcalidraw on private Page',
          present: true,
          options: { isPublic: false }
        },
        {
          desc: 'displays createExcalidraw on a read-write public Page',
          present: true,
          options: { isPublic: true, canUpload: true }
        },
        {
          desc: 'does not display createExcalidraw on a read-only public Page',
          present: false,
          options: { isPublic: true, canUpload: false }
        }
      ])('$desc', ({ present, options }) =>
        expectMenuItem('Excalidraw', present, options)
      )
    })
  })
})
