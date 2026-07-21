import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'

import { LinkAccessModal } from './LinkAccessModal'

jest.mock('cozy-sharing', () => ({
  ShareLinkAccessModal: ({
    documents,
    onCancel,
    onSuccess,
    renderDocumentIcon
  }) => (
    <div role="dialog" aria-label="Set link access">
      {documents.map(document => (
        <div key={document._id}>
          {renderDocumentIcon(document, 18)}
          {document.name}
        </div>
      ))}
      <button type="button" onClick={onCancel}>
        Cancel
      </button>
      <button
        type="button"
        onClick={() =>
          onSuccess([
            { documentId: documents[0]._id, url: 'https://first' },
            { documentId: documents[1]._id, url: 'https://second' }
          ])
        }
      >
        Add links
      </button>
    </div>
  )
}))

jest.mock('@/modules/filelist/icons/FileThumbnail', () => ({
  __esModule: true,
  default: ({ file, size }) => (
    <span data-testid={`thumbnail-${file._id}`} data-size={size} />
  )
}))

describe('LinkAccessModal', () => {
  const selectedItems = [
    { _id: 'file-id', name: 'invoice.pdf' },
    { _id: 'folder-id', name: 'Projects' }
  ]

  it('renders the shared link access modal with document thumbnails', () => {
    render(
      <LinkAccessModal
        selectedItems={selectedItems}
        onCancel={jest.fn()}
        onConfirm={jest.fn()}
      />
    )

    expect(screen.queryByText('invoice.pdf')).toBeInTheDocument()
    expect(screen.queryByText('Projects')).toBeInTheDocument()
    expect(screen.queryByTestId('thumbnail-file-id')).toHaveAttribute(
      'data-size',
      '18'
    )
    expect(screen.queryByTestId('thumbnail-folder-id')).toHaveAttribute(
      'data-size',
      '18'
    )
  })

  it('forwards cancellation to the file picker', () => {
    const onCancel = jest.fn()
    render(
      <LinkAccessModal
        selectedItems={selectedItems}
        onCancel={onCancel}
        onConfirm={jest.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('forwards generated links to the file picker', () => {
    const onConfirm = jest.fn()
    render(
      <LinkAccessModal
        selectedItems={selectedItems}
        onCancel={jest.fn()}
        onConfirm={onConfirm}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Add links' }))

    expect(onConfirm).toHaveBeenCalledWith([
      { documentId: 'file-id', url: 'https://first' },
      { documentId: 'folder-id', url: 'https://second' }
    ])
  })
})
