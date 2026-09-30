import { renderHook } from '@testing-library/react'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'

import { computeIsSharingsOwner, useFileLink } from './useFileLink'

import { ROUTER_FUTURE_FLAGS } from '@/constants/config'

jest.mock('cozy-client', () => ({
  ...jest.requireActual('cozy-client'),
  useClient: jest.fn(() => ({
    getStackClient: (): { uri: string } => ({
      uri: 'http://cozy.localhost:8080'
    }),
    getInstanceOptions: (): { subdomain: string } => ({ subdomain: 'nested' })
  }))
}))
jest.mock('cozy-sharing', () => ({ useSharingContext: jest.fn() }))
jest.mock('cozy-ui/transpiled/react/providers/Breakpoints', () => ({
  __esModule: true,
  default: jest.fn(() => ({ isDesktop: true }))
}))
jest.mock('@/modules/public/PublicProvider', () => ({
  usePublicContext: jest.fn(() => ({ isPublic: false }))
}))

describe('useFileLink with forceFolderPath', () => {
  const folder = {
    _id: 'folder-1',
    _type: 'io.cozy.files',
    type: 'directory',
    name: 'Folder',
    dir_id: 'io.cozy.files.root-dir'
  }

  it.each([
    '/folder/io.cozy.files.root-dir',
    '/recent',
    '/sharings/with-me',
    '/sharings/by-me',
    '/sharings/with-me/folder/shared-folder-1'
  ])('links a folder to /folder/:id from %s', pathname => {
    const { result } = renderHook(
      () => useFileLink(folder, { forceFolderPath: true }),
      {
        wrapper: ({ children }: { children: React.ReactNode }) => (
          <MemoryRouter
            future={ROUTER_FUTURE_FLAGS}
            initialEntries={[pathname]}
          >
            {children}
          </MemoryRouter>
        )
      }
    )

    expect(result.current.link.to.pathname).toBe('/folder/folder-1')
  })
})

describe('computeIsSharingsOwner', () => {
  const ownerSharingContext = {
    allLoaded: true,
    byDocId: { 'file-1': {} },
    isOwner: jest.fn((docId: string) => docId === 'file-1')
  }

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('returns true for an owner shared document opened from a tab route', () => {
    expect(
      computeIsSharingsOwner({
        file: {
          _id: 'file-1',
          _type: 'io.cozy.files',
          type: 'file',
          name: 'file.pdf',
          dir_id: 'io.cozy.files.root-dir'
        },
        pathname: '/sharings/by-me',
        isPublic: false,
        sharingContext: ownerSharingContext
      })
    ).toBe(true)
  })

  it('returns false for a document absent from byDocId', () => {
    expect(
      computeIsSharingsOwner({
        file: {
          _id: 'nested-file-1',
          _type: 'io.cozy.files',
          type: 'file',
          name: 'nested-file.pdf',
          dir_id: 'shared-folder-1'
        },
        pathname: '/sharings/with-me/folder/shared-folder-1',
        isPublic: false,
        sharingContext: {
          allLoaded: true,
          byDocId: {},
          isOwner: jest.fn(() => true)
        }
      })
    ).toBe(false)
  })

  it('returns false while sharings are not loaded', () => {
    expect(
      computeIsSharingsOwner({
        file: {
          _id: 'file-1',
          _type: 'io.cozy.files',
          type: 'file',
          name: 'file.pdf',
          dir_id: 'io.cozy.files.root-dir'
        },
        pathname: '/sharings/by-me',
        isPublic: false,
        sharingContext: {
          ...ownerSharingContext,
          allLoaded: false
        }
      })
    ).toBe(false)
  })

  it('returns false in public mode', () => {
    expect(
      computeIsSharingsOwner({
        file: {
          _id: 'file-1',
          _type: 'io.cozy.files',
          type: 'file',
          name: 'file.pdf',
          dir_id: 'io.cozy.files.root-dir'
        },
        pathname: '/sharings/by-me',
        isPublic: true,
        sharingContext: ownerSharingContext
      })
    ).toBe(false)
  })
})
