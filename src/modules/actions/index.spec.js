import { download } from './index'

describe('download', () => {
  it('should display for a single file', () => {
    const files = [{ type: 'file' }]
    const dl = download({ client: {}, t: () => {} })
    expect(dl.displayCondition(files)).toBe(true)
  })

  it('should display for a folder', () => {
    const files = [{ type: 'directory' }]
    const dl = download({ client: {}, t: () => {} })
    expect(dl.displayCondition(files)).toBe(true)
  })

  it('should display for a mixed selection', () => {
    const files = [{ type: 'file' }, { type: 'directory' }]
    const dl = download({ client: {}, t: () => {} })
    expect(dl.displayCondition(files)).toBe(true)
  })

  it('should not display for an empty selection', () => {
    const dl = download({ client: {}, t: () => {} })
    expect(dl.displayCondition([])).toBe(false)
  })
})
