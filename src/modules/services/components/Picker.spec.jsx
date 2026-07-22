import { fireEvent, render, waitFor } from '@testing-library/react'
import React from 'react'

import { makeSharingLink } from 'cozy-client/dist/models/sharing'

import {
  filePickerErrorCodes,
  filePickerLinkModes,
  TEMPORARY_LINK_TTL
} from './FilePicker/constants'
import Picker from './Picker'

const mockQuery = jest.fn()
const mockGetStackClient = jest.fn()
const mockGetDownloadLinkById = jest.fn()
const mockFindLinksByDoctype = jest.fn()
const mockCozyClient = jest.fn()

jest.mock('@/lib/logger', () => ({
  __esModule: true,
  default: {
    warn: jest.fn()
  }
}))

jest.mock('cozy-client', () => {
  const generateWebLink = jest.fn()
  return {
    __esModule: true,
    default: function CozyClient(...args) {
      return mockCozyClient(...args)
    },
    Q: () => ({ getById: id => ({ id }) }),
    fetchPolicies: {
      olderThan: () => () => true
    },
    generateWebLink,
    models: {
      file: {
        isFile: item => item?.type === 'file'
      }
    },
    useClient: () => ({
      query: mockQuery,
      getStackClient: mockGetStackClient,
      collection: () => ({
        findLinksByDoctype: mockFindLinksByDoctype,
        getDownloadLinkById: mockGetDownloadLinkById
      }),
      capabilities: {}
    })
  }
})

jest.mock('cozy-client/dist/models/sharing', () => ({
  makeSharingLink: jest.fn()
}))

jest.mock('./FilePicker', () => ({ onChange, filePickerConfig, multiple }) => {
  const React = jest.requireActual('react')
  const [error, setError] = React.useState(null)

  // Expose the received config so tests can assert on the transit.
  return (
    <div>
      <div data-testid="received-config">
        {JSON.stringify(filePickerConfig)}
      </div>
      <div data-testid="received-multiple">{multiple ? 'true' : 'false'}</div>
      {error && <div data-testid="error-message">{error}</div>}
      <button
        type="button"
        data-testid="public-link-btn"
        onClick={async () => {
          const pickError = await onChange(
            'file-id',
            filePickerLinkModes.PUBLIC_LINK
          )
          if (pickError) setError(pickError)
        }}
      >
        Public link
      </button>
      <button
        type="button"
        data-testid="generated-public-links-btn"
        onClick={async () => {
          const pickError = await onChange(
            [
              {
                _id: 'file-id',
                type: 'file',
                name: 'invoice.pdf',
                size: '42',
                mime: 'application/pdf'
              }
            ],
            filePickerLinkModes.PUBLIC_LINK,
            [
              {
                documentId: 'file-id',
                url: 'https://drive.example/public?sharecode=abc'
              }
            ]
          )
          if (pickError) setError(pickError)
        }}
      >
        Generated public links
      </button>
      <button
        type="button"
        data-testid="temporary-download-link-btn"
        onClick={async () => {
          const pickError = await onChange(
            'file-id',
            filePickerLinkModes.TEMPORARY_DOWNLOAD_LINK
          )
          if (pickError) setError(pickError)
        }}
      >
        Temporary link
      </button>
      <button
        type="button"
        data-testid="reference-btn"
        onClick={async () => {
          const pickError = await onChange(
            'file-id',
            filePickerLinkModes.REFERENCE
          )
          if (pickError) setError(pickError)
        }}
      >
        Reference
      </button>
      <button
        type="button"
        data-testid="multiple-reference-btn"
        onClick={async () => {
          const pickError = await onChange(
            ['file-id', 'second-file-id'],
            filePickerLinkModes.REFERENCE
          )
          if (pickError) setError(pickError)
        }}
      >
        Multiple reference
      </button>
      <button
        type="button"
        data-testid="multiple-public-link-btn"
        onClick={async () => {
          const pickError = await onChange(
            ['file-id', 'second-file-id'],
            filePickerLinkModes.PUBLIC_LINK
          )
          if (pickError) setError(pickError)
        }}
      >
        Multiple public link
      </button>
      <button
        type="button"
        data-testid="multiple-temporary-download-link-btn"
        onClick={async () => {
          const pickError = await onChange(
            ['file-id', 'second-file-id'],
            filePickerLinkModes.TEMPORARY_DOWNLOAD_LINK
          )
          if (pickError) setError(pickError)
        }}
      >
        Multiple temporary link
      </button>
    </div>
  )
})

const mockFile = {
  _id: 'file-id',
  type: 'file',
  name: 'invoice.pdf',
  size: '42',
  mime: 'application/pdf'
}

const mockSecondFile = {
  _id: 'second-file-id',
  type: 'file',
  name: 'receipt.pdf',
  size: '84',
  mime: 'application/pdf'
}

const setup = ({ intent = null } = {}) => {
  const service = {
    terminate: jest.fn(),
    throw: jest.fn()
  }

  return {
    service,
    ...render(<Picker service={service} intent={intent} />)
  }
}

describe('Picker', () => {
  beforeEach(() => {
    mockGetStackClient.mockReturnValue({ uri: 'https://alice.example' })
    mockFindLinksByDoctype.mockResolvedValue({ data: [] })
    mockCozyClient.mockReturnValue({
      collection: () => ({ getDownloadLinkById: mockGetDownloadLinkById })
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should pass the default filePickerConfig when the intent carries no data', () => {
    const { getByTestId } = setup({ intent: null })
    const received = JSON.parse(getByTestId('received-config').textContent)

    expect(received.sharingLink).toEqual({ allowFolder: true })
    expect(received.downloadLink).toEqual({ allowFolder: false })
  })

  it('should pass the client-provided config from the intent to the FilePicker', () => {
    const intent = {
      attributes: {
        data: {
          sharingLink: { label: 'As link' },
          downloadLink: { label: 'As attachment' }
        }
      }
    }
    const { getByTestId } = setup({ intent })
    const received = JSON.parse(getByTestId('received-config').textContent)

    expect(received.sharingLink).toEqual({
      allowFolder: true,
      label: 'As link'
    })
    expect(received.downloadLink).toEqual({
      allowFolder: false,
      label: 'As attachment'
    })
  })

  it('should render the FilePicker in multiple selection mode by default', () => {
    const { getByTestId } = setup()

    expect(getByTestId('received-multiple')).toHaveTextContent('true')
  })

  it('should render the FilePicker in single selection mode when configured', () => {
    const intent = {
      attributes: {
        data: { multiple: false }
      }
    }
    const { getByTestId } = setup({ intent })

    expect(getByTestId('received-multiple')).toHaveTextContent('false')
  })

  it('should refresh files before terminating with links generated by the access modal', async () => {
    mockQuery.mockResolvedValue({
      data: {
        ...mockFile,
        name: 'updated-invoice.pdf',
        size: '84'
      }
    })
    const { service, getByTestId } = setup()

    fireEvent.click(getByTestId('generated-public-links-btn'))

    await waitFor(() => expect(service.terminate).toHaveBeenCalled())
    expect(mockQuery).toHaveBeenCalledWith(
      { id: 'file-id' },
      expect.objectContaining({
        as: 'picker-confirm-file-id',
        fetchPolicy: expect.any(Function)
      })
    )
    expect(makeSharingLink).not.toHaveBeenCalled()
    expect(service.terminate).toHaveBeenCalledWith([
      {
        id: 'file-id',
        name: 'updated-invoice.pdf',
        size: 84,
        mimeType: 'application/pdf',
        sharingLink: 'https://drive.example/public?sharecode=abc',
        thumbnail: {
          link: 'https://files.twake.app/email-assets/file-picker/pdf.png'
        }
      }
    ])
  })

  it('should terminate with a bare array containing a reference entry', async () => {
    mockQuery.mockResolvedValue({
      data: { ...mockFile, name: 'updated-invoice.pdf', type: 'file' }
    })
    const { service, getByTestId } = setup()

    fireEvent.click(getByTestId('reference-btn'))

    await waitFor(() => expect(service.terminate).toHaveBeenCalled())
    expect(makeSharingLink).not.toHaveBeenCalled()
    expect(mockGetDownloadLinkById).not.toHaveBeenCalled()
    expect(service.terminate).toHaveBeenCalledWith([
      {
        id: 'file-id',
        name: 'updated-invoice.pdf',
        size: 42,
        mimeType: 'application/pdf',
        thumbnail: {
          link: 'https://files.twake.app/email-assets/file-picker/pdf.png'
        },
        type: 'file',
        doctype: 'io.cozy.files'
      }
    ])
  })

  it('should terminate with a bare array containing a public link entry', async () => {
    mockQuery.mockResolvedValue({ data: mockFile })
    makeSharingLink.mockResolvedValue(
      'https://drive.example/public?sharecode=abc'
    )
    const { service, getByTestId } = setup()

    fireEvent.click(getByTestId('public-link-btn'))

    await waitFor(() => expect(service.terminate).toHaveBeenCalled())
    expect(makeSharingLink).toHaveBeenCalledWith(expect.any(Object), [
      'file-id'
    ])
    expect(service.terminate).toHaveBeenCalledWith([
      {
        id: 'file-id',
        name: 'invoice.pdf',
        size: 42,
        mimeType: 'application/pdf',
        sharingLink: 'https://drive.example/public?sharecode=abc',
        thumbnail: {
          link: 'https://files.twake.app/email-assets/file-picker/pdf.png'
        }
      }
    ])
  })

  it('should terminate with a bare array containing multiple reference entries', async () => {
    mockQuery.mockImplementation(({ id }) =>
      Promise.resolve({
        data: id === 'file-id' ? mockFile : mockSecondFile
      })
    )
    const { service, getByTestId } = setup()

    fireEvent.click(getByTestId('multiple-reference-btn'))

    await waitFor(() => expect(service.terminate).toHaveBeenCalled())
    expect(service.terminate).toHaveBeenCalledWith([
      {
        id: 'file-id',
        name: 'invoice.pdf',
        size: 42,
        mimeType: 'application/pdf',
        thumbnail: {
          link: 'https://files.twake.app/email-assets/file-picker/pdf.png'
        },
        type: 'file',
        doctype: 'io.cozy.files'
      },
      {
        id: 'second-file-id',
        name: 'receipt.pdf',
        size: 84,
        mimeType: 'application/pdf',
        thumbnail: {
          link: 'https://files.twake.app/email-assets/file-picker/pdf.png'
        },
        type: 'file',
        doctype: 'io.cozy.files'
      }
    ])
    expect(makeSharingLink).not.toHaveBeenCalled()
    expect(mockGetDownloadLinkById).not.toHaveBeenCalled()
  })

  it('should terminate with a bare array containing public link entries', async () => {
    mockQuery.mockImplementation(({ id }) => {
      return Promise.resolve({
        data: id === 'file-id' ? mockFile : mockSecondFile
      })
    })
    makeSharingLink
      .mockResolvedValueOnce('https://drive.example/public?sharecode=abc')
      .mockResolvedValueOnce('https://drive.example/public?sharecode=def')
    const { service, getByTestId } = setup()

    fireEvent.click(getByTestId('multiple-public-link-btn'))

    await waitFor(() => expect(service.terminate).toHaveBeenCalled())
    expect(makeSharingLink).toHaveBeenCalledWith(expect.any(Object), [
      'file-id'
    ])
    expect(makeSharingLink).toHaveBeenCalledWith(expect.any(Object), [
      'second-file-id'
    ])
    expect(service.terminate).toHaveBeenCalledWith([
      {
        id: 'file-id',
        name: 'invoice.pdf',
        size: 42,
        mimeType: 'application/pdf',
        sharingLink: 'https://drive.example/public?sharecode=abc',
        thumbnail: {
          link: 'https://files.twake.app/email-assets/file-picker/pdf.png'
        }
      },
      {
        id: 'second-file-id',
        name: 'receipt.pdf',
        size: 84,
        mimeType: 'application/pdf',
        sharingLink: 'https://drive.example/public?sharecode=def',
        thumbnail: {
          link: 'https://files.twake.app/email-assets/file-picker/pdf.png'
        }
      }
    ])
  })

  it('should terminate with a bare array containing a temporary download link entry', async () => {
    mockQuery.mockResolvedValue({ data: mockFile })
    makeSharingLink.mockResolvedValue(
      'https://drive.example/public?sharecode=abc'
    )
    mockGetDownloadLinkById.mockResolvedValue(
      'https://alice.example/files/downloads/123/invoice.pdf?Dl=1'
    )
    const { service, getByTestId } = setup()

    fireEvent.click(getByTestId('temporary-download-link-btn'))

    await waitFor(() => expect(service.terminate).toHaveBeenCalled())
    expect(makeSharingLink).toHaveBeenCalledWith(
      expect.any(Object),
      ['file-id'],
      {
        ttl: TEMPORARY_LINK_TTL
      }
    )
    expect(mockCozyClient).toHaveBeenCalledWith({
      uri: 'https://alice.example',
      token: 'abc',
      useCustomStore: true
    })
    expect(mockGetDownloadLinkById).toHaveBeenCalledWith(
      'file-id',
      'invoice.pdf'
    )
    expect(service.terminate).toHaveBeenCalledWith([
      {
        id: 'file-id',
        name: 'invoice.pdf',
        size: 42,
        mimeType: 'application/pdf',
        downloadLink:
          'https://alice.example/files/downloads/123/invoice.pdf?Dl=1',
        thumbnail: {
          link: 'https://files.twake.app/email-assets/file-picker/pdf.png'
        }
      }
    ])
  })

  it('should use one temporary sharing link for multiple download links', async () => {
    mockQuery.mockImplementation(({ id }) => {
      return Promise.resolve({
        data: id === 'file-id' ? mockFile : mockSecondFile
      })
    })
    makeSharingLink.mockResolvedValue(
      'https://drive.example/public?sharecode=abc'
    )
    mockGetDownloadLinkById
      .mockResolvedValueOnce(
        'https://alice.example/files/downloads/123/invoice.pdf?Dl=1'
      )
      .mockResolvedValueOnce(
        'https://alice.example/files/downloads/456/receipt.pdf?Dl=1'
      )
    const { service, getByTestId } = setup()

    fireEvent.click(getByTestId('multiple-temporary-download-link-btn'))

    await waitFor(() => expect(service.terminate).toHaveBeenCalled())
    expect(makeSharingLink).toHaveBeenCalledTimes(1)
    expect(makeSharingLink).toHaveBeenCalledWith(
      expect.any(Object),
      ['file-id', 'second-file-id'],
      {
        ttl: TEMPORARY_LINK_TTL
      }
    )
    expect(mockCozyClient).toHaveBeenCalledTimes(1)
    expect(mockGetDownloadLinkById).toHaveBeenNthCalledWith(
      1,
      'file-id',
      'invoice.pdf'
    )
    expect(mockGetDownloadLinkById).toHaveBeenNthCalledWith(
      2,
      'second-file-id',
      'receipt.pdf'
    )
    expect(service.terminate).toHaveBeenCalledWith([
      {
        id: 'file-id',
        name: 'invoice.pdf',
        size: 42,
        mimeType: 'application/pdf',
        downloadLink:
          'https://alice.example/files/downloads/123/invoice.pdf?Dl=1',
        thumbnail: {
          link: 'https://files.twake.app/email-assets/file-picker/pdf.png'
        }
      },
      {
        id: 'second-file-id',
        name: 'receipt.pdf',
        size: 84,
        mimeType: 'application/pdf',
        downloadLink:
          'https://alice.example/files/downloads/456/receipt.pdf?Dl=1',
        thumbnail: {
          link: 'https://files.twake.app/email-assets/file-picker/pdf.png'
        }
      }
    ])
  })

  it('should return an ITEM_NOT_FOUND error code when metadata loading fails', async () => {
    mockQuery.mockRejectedValue(new Error('not found'))
    const { service, getByTestId, findByTestId } = setup()

    fireEvent.click(getByTestId('public-link-btn'))

    const errorMessage = await findByTestId('error-message')
    expect(errorMessage.textContent).toBe(filePickerErrorCodes.ITEM_NOT_FOUND)
    expect(service.throw).not.toHaveBeenCalled()
    expect(service.terminate).not.toHaveBeenCalled()
  })

  it('should reuse an existing sharing link instead of creating a new one', async () => {
    mockQuery.mockResolvedValue({ data: mockFile })
    mockFindLinksByDoctype.mockResolvedValue({
      data: [
        {
          attributes: {
            permissions: {
              files: {
                values: ['file-id']
              }
            },
            shortcodes: {
              code: 'existing-code'
            }
          }
        }
      ]
    })
    const { generateWebLink } = require('cozy-client')
    generateWebLink.mockReturnValue(
      'https://drive.example/public?sharecode=existing-code'
    )
    const { service, getByTestId } = setup()

    fireEvent.click(getByTestId('public-link-btn'))

    await waitFor(() => expect(service.terminate).toHaveBeenCalled())
    expect(makeSharingLink).not.toHaveBeenCalled()
    expect(service.terminate).toHaveBeenCalledWith([
      {
        id: 'file-id',
        name: 'invoice.pdf',
        size: 42,
        mimeType: 'application/pdf',
        sharingLink: 'https://drive.example/public?sharecode=existing-code',
        thumbnail: {
          link: 'https://files.twake.app/email-assets/file-picker/pdf.png'
        }
      }
    ])
  })

  it('should return a SHARING_LINK_FAILED error code when public link generation fails', async () => {
    mockQuery.mockResolvedValue({ data: mockFile })
    makeSharingLink.mockRejectedValue(new Error('sharing failed'))
    const { service, getByTestId, findByTestId } = setup()

    fireEvent.click(getByTestId('public-link-btn'))

    const errorMessage = await findByTestId('error-message')
    expect(errorMessage.textContent).toBe(
      filePickerErrorCodes.SHARING_LINK_FAILED
    )
    expect(service.throw).not.toHaveBeenCalled()
    expect(service.terminate).not.toHaveBeenCalled()
  })

  it('should return a DOWNLOAD_LINK_FAILED error code when temporary link generation fails', async () => {
    mockQuery.mockResolvedValue({ data: mockFile })
    makeSharingLink.mockResolvedValue('https://drive.example/public')
    const { service, getByTestId, findByTestId } = setup()

    fireEvent.click(getByTestId('temporary-download-link-btn'))

    const errorMessage = await findByTestId('error-message')
    expect(errorMessage.textContent).toBe(
      filePickerErrorCodes.DOWNLOAD_LINK_FAILED
    )
    expect(service.throw).not.toHaveBeenCalled()
    expect(service.terminate).not.toHaveBeenCalled()
  })
})
