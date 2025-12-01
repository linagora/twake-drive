/* eslint-env jest */
import { fireEvent, render, waitFor } from '@testing-library/react'
import mediaQuery from 'css-mediaquery'
import React from 'react'

import { createMockClient } from 'cozy-client'
import useBrowserOffline from 'cozy-ui/transpiled/react/hooks/useBrowserOffline'
import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'

import ShortcutCreationModal from './ShortcutCreationModal'
import AppLike from 'test/components/AppLike'

import useDisplayedFolder from '@/hooks/useDisplayedFolder'
import { DOCTYPE_FILES_SHORTCUT } from '@/lib/doctypes'
import { useNewItemHighlightContext } from '@/modules/upload/NewItemHighlightProvider'

const tMock = jest.fn()
const showAlert = jest.fn()

jest.mock('cozy-ui/transpiled/react/hooks/useBrowserOffline')
jest.mock('cozy-ui/transpiled/react/providers/Alert', () => ({
  ...jest.requireActual('cozy-ui/transpiled/react/providers/Alert'),
  __esModule: true,
  useAlert: jest.fn()
}))

jest.mock('lib/logger', () => ({
  error: jest.fn()
}))
jest.mock('hooks/useDisplayedFolder')
jest.mock('@/modules/upload/NewItemHighlightProvider', () => {
  const React = require('react')
  return {
    __esModule: true,
    NewItemHighlightProvider: ({ children }) => <>{children}</>,
    useNewItemHighlightContext: jest.fn()
  }
})

function createMatchMedia(width) {
  return query => ({
    matches: mediaQuery.match(query, { width }),
    addListener: () => {},
    removeListener: () => {}
  })
}
const client = new createMockClient({})
const onCloseSpy = jest.fn()
const addItemsMock = jest.fn()
const defaultProps = {
  displayedFolder: {
    id: 'id'
  },
  onClose: onCloseSpy,
  open: true
}

describe('ShortcutCreationModal', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    useDisplayedFolder.mockReturnValue({ displayedFolder: { id: 'id' } })
    window.matchMedia = createMatchMedia(window.innerWidth)
    tMock.mockImplementation(key => key)
    useAlert.mockReturnValue({ showAlert })
    addItemsMock.mockReset()
    useNewItemHighlightContext.mockReturnValue({
      addItems: addItemsMock
    })
  })

  const setup = props => {
    const { getByLabelText, getByText } = render(
      <AppLike client={client}>
        <ShortcutCreationModal {...props} />
      </AppLike>
    )

    const filenameInput = getByLabelText('Filename')
    const submitButton = getByText('Create')

    return {
      urlInput: getByLabelText('URL'),
      filenameInput,
      submitButton
    }
  }

  it('should display error when filename is empty', async () => {
    // Given
    const { urlInput, submitButton } = setup(defaultProps)
    fireEvent.change(urlInput, { target: { value: 'https://cozy.io' } })

    // When
    fireEvent.click(submitButton)

    // Then
    expect(client.save).not.toHaveBeenCalled()
    expect(showAlert).toHaveBeenCalledTimes(1)
    expect(showAlert).toBeCalledWith(
      expect.objectContaining({ severity: 'error' })
    )
  })

  it('should handle correctly success case', async () => {
    // Given
    const { urlInput, filenameInput, submitButton } = setup(defaultProps)
    fireEvent.change(urlInput, { target: { value: 'https://cozy.io' } })
    fireEvent.change(filenameInput, { target: { value: 'filename.url' } })
    client.save.mockResolvedValue({ data: { _id: 'shortcut-id' } })

    // When
    fireEvent.click(submitButton)

    // Then
    expect(client.save).toHaveBeenCalledWith({
      dir_id: 'id',
      name: 'filename.url',
      _type: DOCTYPE_FILES_SHORTCUT,
      url: 'https://cozy.io'
    })

    await waitFor(() => {
      expect(showAlert).toHaveBeenCalledTimes(1)
      expect(showAlert).toBeCalledWith(
        expect.objectContaining({ severity: 'success' })
      )
    })
    expect(addItemsMock).toHaveBeenCalledWith([
      expect.objectContaining({ _id: 'shortcut-id' })
    ])
  })

  it('should call the optional onCreated prop', async () => {
    const onCreatedMock = jest.fn()
    const { urlInput, filenameInput, submitButton } = setup({
      ...defaultProps,
      onCreated: onCreatedMock
    })

    client.save.mockResolvedValue({ data: {} })
    fireEvent.change(urlInput, { target: { value: 'https://cozy.io' } })
    fireEvent.change(filenameInput, { target: { value: 'filename' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(showAlert).toHaveBeenCalledTimes(1)
      expect(showAlert).toBeCalledWith(
        expect.objectContaining({ severity: 'success' })
      )
    })
    expect(onCreatedMock).toHaveBeenCalled()
  })

  it('should alert error on illegal characters', async () => {
    const { urlInput, filenameInput, submitButton } = setup({
      ...defaultProps,
      onCreated: jest.fn()
    })

    client.save.mockRejectedValue({
      message: 'Invalid filename containing illegal character(s): /'
    })

    fireEvent.change(urlInput, { target: { value: 'https://cozy.io' } })
    fireEvent.change(filenameInput, { target: { value: 'file/name' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(showAlert).toHaveBeenCalledTimes(1)
      expect(showAlert).toBeCalledWith(
        expect.objectContaining({ severity: 'error', duration: 2000 })
      )
    })
  })

  it('should alert error on illegal file name', async () => {
    const { urlInput, filenameInput, submitButton } = setup({
      ...defaultProps,
      onCreated: jest.fn()
    })

    client.save.mockRejectedValue({
      message: 'Invalid filename: ..'
    })

    fireEvent.change(urlInput, { target: { value: 'https://cozy.io' } })
    fireEvent.change(filenameInput, { target: { value: '..' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(showAlert).toHaveBeenCalledTimes(1)
      expect(showAlert).toBeCalledWith(
        expect.objectContaining({ severity: 'error' })
      )
    })
  })

  it('should alert error on missing file name', async () => {
    const { urlInput, filenameInput, submitButton } = setup({
      ...defaultProps,
      onCreated: jest.fn()
    })

    client.save.mockRejectedValue({
      message: 'Missing name argument'
    })

    fireEvent.change(urlInput, { target: { value: 'https://cozy.io' } })
    fireEvent.change(filenameInput, { target: { value: '   ' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(showAlert).toHaveBeenCalledTimes(1)
      expect(showAlert).toBeCalledWith(
        expect.objectContaining({ severity: 'error' })
      )
    })
  })

  it('should alert network error when detected by useBrowserOffline', async () => {
    useBrowserOffline.mockReturnValue(true)
    const { urlInput, filenameInput, submitButton } = setup({
      ...defaultProps,
      onCreated: jest.fn()
    })

    fireEvent.change(urlInput, { target: { value: 'https://cozy.io' } })
    fireEvent.change(filenameInput, { target: { value: '   ' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(showAlert).toHaveBeenCalledTimes(1)
      expect(showAlert).toBeCalledWith(
        expect.objectContaining({ severity: 'error' })
      )
    })
  })

  it('should alert network error when not detected by useBrowserOffline', async () => {
    const { urlInput, filenameInput, submitButton } = setup({
      ...defaultProps,
      onCreated: jest.fn()
    })

    client.save.mockRejectedValue({
      message: 'NetworkError when attempting to fetch resource.'
    })

    fireEvent.change(urlInput, { target: { value: 'https://cozy.io' } })
    fireEvent.change(filenameInput, { target: { value: '   ' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(showAlert).toHaveBeenCalledTimes(1)
      expect(showAlert).toBeCalledWith(
        expect.objectContaining({ severity: 'error' })
      )
    })
  })
})
