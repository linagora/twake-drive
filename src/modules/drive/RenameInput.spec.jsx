import { render, fireEvent, screen, waitFor } from '@testing-library/react'
import React from 'react'

import { createMockClient } from 'cozy-client'
import useBrowserOffline from 'cozy-ui/transpiled/react/hooks/useBrowserOffline'
import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'

import { RenameInput } from './RenameInput'
import AppLike from 'test/components/AppLike'
import { generateFile } from 'test/generate'

const showAlert = jest.fn()

jest.mock('cozy-ui/transpiled/react/hooks/useBrowserOffline')
jest.mock('cozy-ui/transpiled/react/providers/Alert', () => ({
  ...jest.requireActual('cozy-ui/transpiled/react/providers/Alert'),
  __esModule: true,
  useAlert: jest.fn()
}))

jest.mock('@/lib/ViewSwitcherContext', () => ({
  ViewSwitcherContextProvider: ({ children }) => children,
  useViewSwitcherContext: jest.fn(() => ({
    viewType: 'list',
    switchView: jest.fn()
  }))
}))

describe('RenameInput', () => {
  let client
  let onAbort
  let file
  let mockCollection

  beforeEach(() => {
    jest.resetAllMocks()
    mockCollection = {
      update: jest.fn()
    }
    client = {
      ...createMockClient({}),
      collection: jest.fn().mockReturnValue(mockCollection)
    }
    onAbort = jest.fn()
    // Default file without driveId for backward compatibility
    file = {
      ...generateFile({ i: '10', type: 'file' }),
      meta: { rev: '1' },
      _id: 'file123',
      _type: 'io.cozy.files'
      // No driveId by default for backward compatibility
    }
    useAlert.mockReturnValue({ showAlert })
  })

  const setup = ({ file }) => {
    return render(
      <AppLike client={client}>
        <RenameInput file={file} onAbort={onAbort} />
      </AppLike>
    )
  }

  it('tests the component', async () => {
    const { getByText } = setup({ file })
    const inputNode = document.getElementsByTagName('input')[0]

    fireEvent.change(inputNode, { target: { value: 'new Name.pdf' } })
    expect(inputNode.value).toBe('new Name.pdf')
    fireEvent.keyDown(inputNode, { key: 'Enter', code: 'Enter', keyCode: 13 })
    // For backward compatibility, don't expect driveId in the collection call
    expect(client.collection).toHaveBeenCalledWith('io.cozy.files', {})
    expect(mockCollection.update).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'new Name.pdf',
        _rev: '1'
      })
    )
    await waitFor(() => expect(onAbort).toHaveBeenCalled())

    // Check the Modal to inform that we're changing the file extension
    fireEvent.change(inputNode, { target: { value: 'new Name.txt' } })
    expect(inputNode.value).toBe('new Name.txt')
    fireEvent.keyDown(inputNode, { key: 'Enter', code: 'Enter', keyCode: 13 })
    await waitFor(() => screen.getByRole('dialog'))

    fireEvent.click(getByText('Continue'))
    // For backward compatibility, don't expect driveId in the collection call
    expect(client.collection).toHaveBeenCalledWith('io.cozy.files', {})
    expect(mockCollection.update).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'new Name.txt',
        _rev: '1'
      })
    )
    await waitFor(() => expect(onAbort).toHaveBeenCalled())
  })

  it('works without meta rev', async () => {
    // Test with file that doesn't have meta.rev but has _rev
    const fileWithoutMetaRev = {
      ...file,
      _rev: '2',
      meta: {}
    }
    setup({ file: fileWithoutMetaRev })
    const inputNode = document.getElementsByTagName('input')[0]

    fireEvent.change(inputNode, { target: { value: 'new Name.pdf' } })
    fireEvent.keyDown(inputNode, { key: 'Enter', code: 'Enter', keyCode: 13 })
    // For backward compatibility, don't expect driveId in the collection call
    expect(client.collection).toHaveBeenCalledWith('io.cozy.files', {})
    expect(mockCollection.update).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'new Name.pdf',
        _rev: '2'
      })
    )
  })

  it('works with driveId', async () => {
    // Test with explicit driveId
    const fileWithDriveId = {
      ...file,
      driveId: 'special-drive-123',
      _rev: '3',
      meta: { rev: '3' }
    }
    setup({ file: fileWithDriveId })
    const inputNode = document.getElementsByTagName('input')[0]

    fireEvent.change(inputNode, { target: { value: 'drive-file.pdf' } })
    fireEvent.keyDown(inputNode, { key: 'Enter', code: 'Enter', keyCode: 13 })

    // Should include the driveId in the collection options
    expect(client.collection).toHaveBeenCalledWith('io.cozy.files', {
      driveId: 'special-drive-123'
    })

    // Should include the file in the update with the correct _rev
    expect(mockCollection.update).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'drive-file.pdf',
        _rev: '3',
        driveId: 'special-drive-123'
      })
    )
  })

  it('should alert error on illegal characters', async () => {
    setup({ file })
    const inputNode = document.getElementsByTagName('input')[0]

    mockCollection.update.mockRejectedValueOnce({
      message: 'Invalid filename containing illegal character(s): /'
    })

    fireEvent.change(inputNode, { target: { value: 'new/Name.pdf' } })
    fireEvent.keyDown(inputNode, { key: 'Enter', code: 'Enter', keyCode: 13 })

    await waitFor(() => {
      expect(showAlert).toHaveBeenCalledTimes(1)
      expect(showAlert).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'error', duration: 2000 })
      )
    })
  })

  it('should alert error on incorrect file name', async () => {
    setup({ file })
    const inputNode = document.getElementsByTagName('input')[0]

    mockCollection.update.mockRejectedValueOnce({
      message: 'Invalid filename: .'
    })

    fireEvent.change(inputNode, { target: { value: '..pdf' } })
    fireEvent.keyDown(inputNode, { key: 'Enter', code: 'Enter', keyCode: 13 })

    await waitFor(() => {
      expect(showAlert).toHaveBeenCalledTimes(1)
      expect(showAlert).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'error' })
      )
    })
  })

  it('should alert error on missing file name', async () => {
    setup({ file })
    const inputNode = document.getElementsByTagName('input')[0]

    mockCollection.update.mockRejectedValueOnce({
      message: 'Missing name argument'
    })

    fireEvent.change(inputNode, { target: { value: '   .pdf' } })
    fireEvent.keyDown(inputNode, { key: 'Enter', code: 'Enter', keyCode: 13 })

    await waitFor(() => {
      expect(showAlert).toHaveBeenCalledTimes(1)
      expect(showAlert).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'error' })
      )
    })
  })

  it('should alert network error when detected by useBrowserOffline', async () => {
    useBrowserOffline.mockReturnValue(true)
    setup({ file })
    const inputNode = document.getElementsByTagName('input')[0]

    fireEvent.change(inputNode, { target: { value: '   .pdf' } })
    fireEvent.keyDown(inputNode, { key: 'Enter', code: 'Enter', keyCode: 13 })

    await waitFor(() => {
      expect(showAlert).toHaveBeenCalledTimes(1)
      expect(showAlert).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'error' })
      )
    })
  })

  it('should alert network error when not detected by useBrowserOffline', async () => {
    setup({ file })
    const inputNode = document.getElementsByTagName('input')[0]

    mockCollection.update.mockRejectedValueOnce({
      message: 'NetworkError when attempting to fetch resource.'
    })

    fireEvent.change(inputNode, { target: { value: '   .pdf' } })
    fireEvent.keyDown(inputNode, { key: 'Enter', code: 'Enter', keyCode: 13 })

    await waitFor(() => {
      expect(showAlert).toHaveBeenCalledTimes(1)
      expect(showAlert).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'error' })
      )
    })
  })
})
