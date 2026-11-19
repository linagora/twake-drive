import { renderHook } from '@testing-library/react'

import { useSortedRows } from './useSortedRows'

const rows = [
  { _id: 'b', name: 'b.txt', type: 'file' },
  { _id: 'a', name: 'a.txt', type: 'file' }
]
const sortOrder = { attribute: 'name', order: 'asc' }

describe('useSortedRows', () => {
  it('keeps the order of the rows when asked to', () => {
    const { result } = renderHook(() =>
      useSortedRows({ rows, sortOrder, keepQueryOrder: true })
    )

    expect(result.current.map(row => row._id)).toEqual(['b', 'a'])
  })
})
