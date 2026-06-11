import { getFolderViewState } from './getFolderViewState'

describe('getFolderViewState', () => {
  it('reports loading for an empty folder that has never loaded', () => {
    const { isLoading, isEmpty } = getFolderViewState({
      queryResults: [{ fetchStatus: 'loading', data: [] }]
    })

    expect(isLoading).toBe(true)
    expect(isEmpty).toBe(false)
  })

  it('keeps an already-loaded empty folder out of the loading skeleton when it refetches', () => {
    // An in-folder refetch flips fetchStatus back to 'loading'. Because the
    // folder has loaded once (lastUpdate set), it must stay on the empty state
    // instead of flashing the skeleton on every uploaded file.
    const { isLoading, isEmpty } = getFolderViewState({
      queryResults: [
        { fetchStatus: 'loading', data: [], lastUpdate: 1718000000000 }
      ]
    })

    expect(isLoading).toBe(false)
    expect(isEmpty).toBe(true)
  })

  it('shows data and never loading once a folder has rows', () => {
    const { isLoading, hasDataToShow, isEmpty } = getFolderViewState({
      queryResults: [
        { fetchStatus: 'loading', data: [{ _id: '1' }], lastUpdate: 1 }
      ]
    })

    expect(hasDataToShow).toBe(true)
    expect(isLoading).toBe(false)
    expect(isEmpty).toBe(false)
  })

  it('reports an error when a query fails', () => {
    const { isInError } = getFolderViewState({
      queryResults: [{ fetchStatus: 'failed', data: [] }]
    })

    expect(isInError).toBe(true)
  })
})
