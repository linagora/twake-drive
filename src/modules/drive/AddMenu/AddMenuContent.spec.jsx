import { render, waitFor } from '@testing-library/react'
import React from 'react'

import { useAppLinkWithStoreFallback } from 'cozy-client'

import AddMenuContent from './AddMenuContent'
import AppLike from 'test/components/AppLike'
import { setupFolderContent, mockCozyClientRequestQuery } from 'test/setup'

import { ScannerProvider } from '@/modules/drive/Toolbar/components/Scanner/ScannerProvider'

jest.mock('cozy-client/dist/hooks/useAppLinkWithStoreFallback', () => jest.fn())
jest.mock('cozy-keys-lib', () => ({
  useVaultClient: jest.fn()
}))
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

    it('does not display createNote on public Page', async () => {
      await waitFor(async () => {
        const { root } = await setup(
          { folderId: 'directory-foobar0' },
          { isPublic: true }
        )
        const { queryByText } = root
        expect(queryByText('Note')).toBeNull()
      })
    })

    it('displays createNote on private Page', async () => {
      await waitFor(async () => {
        const { root } = await setup(
          { folderId: 'directory-foobar0' },
          { isPublic: false }
        )
        const { queryByText } = root
        expect(queryByText('Note')).toBeTruthy()
      })
    })
  })
})
