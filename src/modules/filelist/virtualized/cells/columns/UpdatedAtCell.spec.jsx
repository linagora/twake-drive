import { render, screen } from '@testing-library/react'
import React from 'react'

import UpdatedAtCell from './UpdatedAtCell'

import { FileLastUpdatedProvider } from '@/modules/filelist/FileLastUpdatedContext'

jest.mock('@/modules/filelist/useFormattedUpdatedAt', () => ({
  useFormattedUpdatedAt: date => `formatted:${date}`
}))

jest.mock('@/modules/filelist/virtualized/cells/LastUpdate', () => {
  const LastUpdate = ({ date, formatted }) => (
    <time dateTime={date}>{formatted}</time>
  )
  return LastUpdate
})

describe('UpdatedAtCell', () => {
  it('renders the timestamp supplied by the file-list provider', () => {
    const lastUpdatedAt = '2026-07-29T08:00:00.000Z'

    render(
      <FileLastUpdatedProvider getFileLastUpdatedAt={() => lastUpdatedAt}>
        <UpdatedAtCell
          row={{
            _id: 'file-id',
            updated_at: '2025-01-01T00:00:00.000Z'
          }}
          cell="2025-01-01T00:00:00.000Z"
        />
      </FileLastUpdatedProvider>
    )

    expect(screen.getByText(`formatted:${lastUpdatedAt}`)).toHaveAttribute(
      'dateTime',
      lastUpdatedAt
    )
  })

  it('renders a placeholder when the provider has no timestamp', () => {
    render(
      <FileLastUpdatedProvider getFileLastUpdatedAt={() => null}>
        <UpdatedAtCell row={{ _id: 'file-id' }} cell={null} />
      </FileLastUpdatedProvider>
    )

    expect(screen.getByText('—')).toBeInTheDocument()
  })
})
