import {
  makeSharingsTabLocation,
  makeSharingsViewLocation
} from './sharingsTabNavigation'

import { DEFAULT_SHARINGS_VIEW_ROUTE } from '@/constants/config'

describe('sharingsTabNavigation', () => {
  it('preserves the active tab for a target inside Sharings', () => {
    expect(
      makeSharingsTabLocation({
        currentLocation: {
          pathname: '/sharings',
          search: '?foo=bar&tab=by-me'
        },
        targetPathname: '/sharings/file/file-1/share'
      })
    ).toEqual({
      pathname: '/sharings/file/file-1/share',
      search: '?tab=by-me'
    })
  })

  it('does not carry the tab outside Sharings', () => {
    expect(
      makeSharingsTabLocation({
        currentLocation: {
          pathname: '/recent',
          search: '?tab=by-me'
        },
        targetPathname: '/recent/file/file-1/share'
      })
    ).toEqual({
      pathname: '/recent/file/file-1/share',
      search: ''
    })
  })

  it('returns the active tab when leaving a Sharings modal', () => {
    expect(
      makeSharingsViewLocation({
        currentLocation: {
          pathname: '/sharings/file/file-1/share',
          search: '?tab=drives'
        }
      })
    ).toEqual({ pathname: '/sharings', search: '?tab=drives' })
  })

  it('uses the default Sharings route outside the section', () => {
    expect(
      makeSharingsViewLocation({
        currentLocation: {
          pathname: '/folder/folder-1/file/file-1/share',
          search: ''
        }
      })
    ).toBe(DEFAULT_SHARINGS_VIEW_ROUTE)
  })
})
