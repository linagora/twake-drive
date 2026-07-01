import { render } from '@testing-library/react'
import React from 'react'

import { useQuery } from 'cozy-client'

import RecentScopeQuery from './RecentScopeQuery'

jest.mock('cozy-client', () => ({
  ...jest.requireActual('cozy-client'),
  useQuery: jest.fn()
}))

jest.mock('@/queries', () => ({
  buildRecentsScopedQuery: jest.fn().mockReturnValue({
    definition: jest.fn(),
    options: {}
  })
}))

describe('RecentScopeQuery', () => {
  it('calls onResult with data when query loads successfully', () => {
    useQuery.mockReturnValue({
      data: [{ _id: 'a' }],
      fetchStatus: 'loaded',
      error: null
    })
    const onResult = jest.fn()

    render(<RecentScopeQuery scopeKey="own" onResult={onResult} />)

    expect(onResult).toHaveBeenCalledWith('own', {
      data: [{ _id: 'a' }],
      fetchStatus: 'loaded',
      error: null
    })
  })

  it('reports empty-loaded for a 403 error', () => {
    useQuery.mockReturnValue({
      data: undefined,
      fetchStatus: 'failed',
      error: { status: 403 }
    })
    const onResult = jest.fn()

    render(
      <RecentScopeQuery
        scopeKey="drive-abc"
        driveId="abc"
        onResult={onResult}
      />
    )

    expect(onResult).toHaveBeenCalledWith('drive-abc', {
      data: [],
      fetchStatus: 'loaded',
      error: null
    })
  })

  it('renders null (empty DOM)', () => {
    useQuery.mockReturnValue({ data: [], fetchStatus: 'loaded', error: null })
    const { container } = render(
      <RecentScopeQuery scopeKey="own" onResult={jest.fn()} />
    )

    expect(container).toBeEmptyDOMElement()
  })
})
