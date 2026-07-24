import {
  getLegacySharingsRoute,
  getSharingsRootRoute,
  getSharingsRouteForTab,
  getSharingsTabFromPath,
  isSharingsTabRootRoute
} from './routes'

describe('Sharings routes', () => {
  it.each`
    route                                                | expected
    ${'/sharings'}                                       | ${'/sharings/with-me'}
    ${'/sharings/file/file-1'}                           | ${'/sharings/with-me/file/file-1'}
    ${'/sharings/file/file-1/v/share'}                   | ${'/sharings/with-me/file/file-1/v/share'}
    ${'/sharings/move'}                                  | ${'/sharings/with-me/move'}
    ${'/sharings/shareddrive/drive-1/file/file-1/share'} | ${'/sharings/with-me/shareddrive/drive-1/file/file-1/share'}
    ${'/sharings/folder-1'}                              | ${'/sharings/with-me/folder/folder-1'}
    ${'/sharings/folder-1/file/file-1/v/revision'}       | ${'/sharings/with-me/folder/folder-1/file/file-1/v/revision'}
    ${'/sharings/folder-1/share'}                        | ${'/sharings/with-me/folder/folder-1/share'}
    ${'/sharings/with-me/unknown-junk'}                  | ${'/sharings/with-me'}
    ${'/sharings/by-me/removed-feature/path'}            | ${'/sharings/by-me'}
  `('redirects $route to $expected', ({ route, expected }) => {
    expect(getLegacySharingsRoute(route)).toBe(expected)
  })

  it('changes only the tab segment of a nested sharings route', () => {
    expect(
      getSharingsRouteForTab(
        '/sharings/drives/folder/folder-1/file/file-1',
        'with-me'
      )
    ).toBe('/sharings/with-me/folder/folder-1/file/file-1')
  })

  it('gets the active tab and its root route from a nested path', () => {
    const pathname = '/sharings/by-me/folder/folder-1/file/file-1'

    expect(getSharingsTabFromPath(pathname)).toBe('by-me')
    expect(getSharingsRootRoute(pathname)).toBe('/sharings/by-me')
  })

  it('falls back to with-me outside a canonical sharings route', () => {
    expect(getSharingsTabFromPath('/folder/folder-1')).toBeNull()
    expect(getSharingsRootRoute('/folder/folder-1')).toBe('/sharings/with-me')
  })

  it('recognizes only canonical tab root routes', () => {
    expect(isSharingsTabRootRoute('/sharings/drives')).toBe(true)
    expect(isSharingsTabRootRoute('/sharings/drives/folder/folder-1')).toBe(
      false
    )
  })
})
