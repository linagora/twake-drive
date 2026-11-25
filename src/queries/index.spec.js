import { buildFavoritesQuery } from './index'

describe('buildFavoritesQuery', () => {
  it.each([
    ['/.cozy_trash', false],
    ['/.cozy_trash/Projects', false],
    ['/.cozy_trash_backup', true],
    ['/xcozy_trash', true],
    ['/Projects/.cozy_trash', true]
  ])('matches favorite path %s: %s', (path, expected) => {
    const query = buildFavoritesQuery({
      sortAttribute: 'name',
      sortOrder: 'asc'
    }).definition()
    const pattern = query.partialFilter.path.$or[1].$regex

    expect(new RegExp(pattern).test(path)).toBe(expected)
  })
})
