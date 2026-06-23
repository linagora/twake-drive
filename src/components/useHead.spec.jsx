import { renderHook } from '@testing-library/react'
import { useParams } from 'react-router-dom'

import { useQuery } from 'cozy-client'

import useHead from './useHead'

import { ROOT_DIR_ID } from '@/constants/config'
import { usePublicContext } from '@/modules/public/PublicProvider'

jest.mock('cozy-client', () => ({
  ...jest.requireActual('cozy-client'),
  useQuery: jest.fn()
}))

jest.mock('react-router-dom', () => ({
  useParams: jest.fn()
}))

jest.mock('@/modules/public/PublicProvider')
jest.mock('@/hooks/useUpdateFavicon')
jest.mock('@/modules/views/useUpdateDocumentTitle')

describe('useHead', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    usePublicContext.mockReturnValue({ isPublic: false })
    useQuery.mockReturnValue({ data: null, fetchStatus: 'pending' })
  })

  it('does not query the instance root directory on the public route', () => {
    // The instance root is forbidden for public-share tokens; querying it 403s
    // and leaks as an unhandled rejection through useQuery.
    useParams.mockReturnValue({ folderId: ROOT_DIR_ID })
    usePublicContext.mockReturnValue({ isPublic: true })

    renderHook(() => useHead())

    expect(useQuery).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ enabled: false })
    )
  })

  it('queries the folder on the authenticated route', () => {
    useParams.mockReturnValue({ folderId: ROOT_DIR_ID })
    usePublicContext.mockReturnValue({ isPublic: false })

    renderHook(() => useHead())

    expect(useQuery).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ enabled: true })
    )
  })
})
