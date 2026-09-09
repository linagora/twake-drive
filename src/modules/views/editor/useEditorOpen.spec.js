import { renderHook } from '@testing-library/react'

import { useClient } from 'cozy-client'
import useFetchJSON from 'cozy-client/dist/hooks/useFetchJSON'

import { useEditorOpen } from './useEditorOpen'

import { changeLocation } from '@/hooks/helpers'

jest.mock('cozy-client', () => ({
  ...jest.requireActual('cozy-client'),
  useClient: jest.fn()
}))
jest.mock('cozy-client/dist/hooks/useFetchJSON', () => ({
  __esModule: true,
  default: jest.fn()
}))
jest.mock('react-router-dom', () => ({
  useSearchParams: () => [new URLSearchParams(mockSearch)]
}))
jest.mock('@/lib/logger', () => ({ warn: jest.fn(), error: jest.fn() }))
jest.mock('@/hooks/helpers', () => ({
  ...jest.requireActual('@/hooks/helpers'),
  changeLocation: jest.fn()
}))

let mockSearch = ''

const makeResponse = instance => ({
  data: {
    attributes: {
      file_id: 'owner-file-id',
      protocol: 'https',
      instance,
      subdomain: 'flat',
      sharecode: 'abc123',
      public_name: 'Bob'
    }
  }
})

const renderEditorOpen = (props = {}) =>
  renderHook(() =>
    useEditorOpen({ fileId: 'local-file-id', slug: 'excalidraw', ...props })
  )

describe('useEditorOpen', () => {
  beforeEach(() => {
    mockSearch = ''
    useClient.mockReturnValue({
      getStackClient: () => ({ uri: 'https://bob.cozy.example' })
    })
  })

  it('asks the stack where the file must be opened', () => {
    useFetchJSON.mockReturnValue({ fetchStatus: 'loading', data: null })

    renderEditorOpen()

    expect(useFetchJSON).toHaveBeenCalledWith(
      'GET',
      '/editor/local-file-id/open'
    )
  })

  it('goes through the shared drive when the file belongs to one', () => {
    useFetchJSON.mockReturnValue({ fetchStatus: 'loading', data: null })

    renderEditorOpen({ driveId: 'drive-id' })

    expect(useFetchJSON).toHaveBeenCalledWith(
      'GET',
      '/sharings/drives/drive-id/editor/local-file-id/open'
    )
  })

  it('waits while the stack has not answered', () => {
    useFetchJSON.mockReturnValue({ fetchStatus: 'loading', data: null })

    const { result } = renderEditorOpen()

    expect(result.current).toBe('loading')
    expect(changeLocation).not.toHaveBeenCalled()
  })

  it('opens locally when the file lives on this instance', () => {
    useFetchJSON.mockReturnValue({
      fetchStatus: 'loaded',
      data: makeResponse('bob.cozy.example')
    })

    const { result } = renderEditorOpen()

    expect(result.current).toBe('local')
    expect(changeLocation).not.toHaveBeenCalled()
  })

  it("redirects to the owner's instance when the file lives there", () => {
    useFetchJSON.mockReturnValue({
      fetchStatus: 'loaded',
      data: makeResponse('alice.cozy.example')
    })

    const { result } = renderEditorOpen()

    expect(result.current).toBe('redirecting')
    expect(changeLocation).toHaveBeenCalledWith(
      'https://alice-drive.cozy.example/public/?sharecode=abc123&username=Bob#/excalidraw/owner-file-id'
    )
  })

  it('forwards the link to come back to', () => {
    mockSearch = 'redirectLink=drive%23%2Ffolder%2Fabc'
    useFetchJSON.mockReturnValue({
      fetchStatus: 'loaded',
      data: makeResponse('alice.cozy.example')
    })

    renderEditorOpen()

    expect(changeLocation.mock.calls[0][0]).toContain(
      'redirectLink=drive%23%2Ffolder%2Fabc'
    )
  })

  it('redirects only once when the hook re-renders', () => {
    useFetchJSON.mockReturnValue({
      fetchStatus: 'loaded',
      data: makeResponse('alice.cozy.example')
    })

    const { rerender } = renderEditorOpen()
    rerender()

    expect(changeLocation).toHaveBeenCalledTimes(1)
  })

  it('redirects again when the route switches to another remote file', () => {
    useFetchJSON.mockReturnValue({
      fetchStatus: 'loaded',
      data: makeResponse('alice.cozy.example')
    })

    const { rerender } = renderEditorOpen()

    useFetchJSON.mockReturnValue({
      fetchStatus: 'loaded',
      data: makeResponse('carol.cozy.example')
    })
    rerender()

    expect(changeLocation).toHaveBeenCalledTimes(2)
    expect(changeLocation.mock.calls[1][0]).toContain(
      'carol-drive.cozy.example'
    )
  })

  it('falls back to the local copy when the stack cannot resolve the file', () => {
    useFetchJSON.mockReturnValue({ fetchStatus: 'error', data: null })

    const { result } = renderEditorOpen()

    expect(result.current).toBe('local')
    expect(changeLocation).not.toHaveBeenCalled()
  })
})
