import { renderHook, act } from '@testing-library/react'
import { useSearchParams, useNavigate } from 'react-router-dom'

import { useClient } from 'cozy-client'

import * as helpers from './helpers'
import { useRedirectLink } from './useRedirectLink'

jest.mock('cozy-client', () => ({
  ...jest.requireActual('cozy-client'),
  useClient: jest.fn()
}))

jest.mock('react-router-dom', () => ({
  useSearchParams: jest.fn(),
  useNavigate: jest.fn()
}))

const originalHistory = window.history

describe('useRedirectLink', () => {
  const mockClient = {
    collection: jest.fn().mockReturnValue({
      fetchOwnPermissions: jest.fn().mockResolvedValue({
        included: []
      })
    }),
    getStackClient: jest.fn().mockReturnValue({
      uri: 'https://my.cozy.cloud'
    }),
    getInstanceOptions: jest.fn().mockReturnValue({
      subdomain: 'flat'
    })
  }
  const mockNavigate = jest.fn()

  beforeEach(() => {
    useClient.mockReturnValue(mockClient)
    useSearchParams.mockReturnValue([
      new URLSearchParams('?redirectLink=drive%23%2Ffolder%2Fid123')
    ])
    useNavigate.mockReturnValue(mockNavigate)
  })

  afterEach(() => {
    window.history = originalHistory
    jest.clearAllMocks()
  })

  it('should redirect with navigate when is not public', async () => {
    let render
    await act(async () => {
      render = renderHook(() => useRedirectLink())
    })

    render.result.current.redirectBack()

    expect(mockNavigate).toHaveBeenCalledWith('/folder/id123')
    expect(render.result.current.redirectLink).toBe('drive#/folder/id123')
    expect(render.result.current.canRedirect).toBe(true)
  })

  it('should redirect with navigate when is from a public folder', async () => {
    useSearchParams.mockReturnValue([
      new URLSearchParams(
        '?redirectLink=drive%23%2Ffolder%2Fid123&fromPublicFolder=true'
      )
    ])
    let render
    await act(async () => {
      render = renderHook(() => useRedirectLink({ isPublic: true }))
    })

    render.result.current.redirectBack()

    expect(mockNavigate).toHaveBeenCalledWith('/folder/id123')
    expect(render.result.current.redirectLink).toBe('drive#/folder/id123')
    expect(render.result.current.canRedirect).toBe(true)
  })

  it('should redirect with window.location in public when instance is known', async () => {
    const spyChangeLocation = jest
      .spyOn(helpers, 'changeLocation')
      .mockImplementationOnce(() => {})
    mockClient.collection().fetchOwnPermissions.mockResolvedValueOnce({
      included: [
        {
          attributes: {
            instance: 'https://other.cozy.cloud'
          }
        }
      ]
    })
    useSearchParams.mockReturnValue([
      new URLSearchParams('?redirectLink=drive%23%2Ffolder%2Fid123')
    ])
    let render
    await act(async () => {
      render = renderHook(() => useRedirectLink({ isPublic: true }))
    })

    render.result.current.redirectBack()

    expect(mockNavigate).toHaveBeenCalledTimes(0)
    expect(spyChangeLocation).toHaveBeenCalledWith(
      'https://other-drive.cozy.cloud/#/folder/id123'
    )
    expect(render.result.current.redirectLink).toBe('drive#/folder/id123')
    expect(render.result.current.canRedirect).toBe(true)
  })

  it('should redirect with navigate(-2) in public when the instance is unknown', async () => {
    delete window.history
    window.history = Object.defineProperties(
      {},
      {
        ...Object.getOwnPropertyDescriptors(originalHistory),
        length: {
          configurable: true,
          value: 3
        }
      }
    )
    mockClient.collection().fetchOwnPermissions.mockResolvedValueOnce({
      included: [
        {
          attributes: {}
        }
      ]
    })
    useSearchParams.mockReturnValue([
      new URLSearchParams('?redirectLink=drive%23%2Ffolder%2Fid123')
    ])
    let render
    await act(async () => {
      render = renderHook(() => useRedirectLink({ isPublic: true }))
    })

    render.result.current.redirectBack()

    expect(mockNavigate).toHaveBeenCalledWith(-2)
    expect(render.result.current.redirectLink).toBe('drive#/folder/id123')
    expect(render.result.current.canRedirect).toBe(true)
  })

  it('should do nothing when the instance is unknown and the page is opened in new tab', async () => {
    mockClient.collection().fetchOwnPermissions.mockResolvedValueOnce({
      included: [
        {
          attributes: {}
        }
      ]
    })
    useSearchParams.mockReturnValue([
      new URLSearchParams('?redirectLink=drive%23%2Ffolder%2Fid123')
    ])
    let render
    await act(async () => {
      render = renderHook(() => useRedirectLink({ isPublic: true }))
    })

    render.result.current.redirectBack()

    expect(mockNavigate).toHaveBeenCalledTimes(0)
    expect(render.result.current.redirectLink).toBe('drive#/folder/id123')
    expect(render.result.current.canRedirect).toBe(false)
  })
})
