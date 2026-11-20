import { render } from '@testing-library/react'
import React from 'react'
import { useDispatch } from 'react-redux'

import { useClient } from 'cozy-client'
import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'
import { useI18n } from 'twake-i18n'

import UploadItem from './UploadItem'

import { useDisplayedFolder } from '@/hooks'
import { isDirectoryPickerAvailable } from '@/modules/upload'
import { useNewItemHighlightContext } from '@/modules/upload/NewItemHighlightProvider'

jest.mock('@linagora/twake-icons', () => ({
  Folder: 'folder',
  Icon: () => null,
  Upload: 'upload'
}))
jest.mock('react-redux', () => ({ useDispatch: jest.fn() }))
jest.mock('cozy-client', () => ({ useClient: jest.fn() }))
jest.mock(
  'cozy-sharing/dist/hoc/withSharingState',
  () => component => component
)
jest.mock(
  'cozy-ui/transpiled/react/ActionsMenu/ActionsMenuItem',
  () =>
    ({ children }) => <div>{children}</div>
)
jest.mock('cozy-ui/transpiled/react/ListItemIcon', () => ({ children }) => (
  <span>{children}</span>
))
jest.mock('cozy-ui/transpiled/react/ListItemText', () => ({ primary }) => (
  <span>{primary}</span>
))
jest.mock('cozy-ui/transpiled/react/providers/Alert', () => ({
  useAlert: jest.fn()
}))
jest.mock('twake-i18n', () => ({ useI18n: jest.fn() }))
jest.mock('@/hooks', () => ({ useDisplayedFolder: jest.fn() }))
jest.mock('@/modules/navigation/duck', () => ({ uploadFiles: jest.fn() }))
jest.mock('@/modules/upload', () => ({
  isDirectoryPickerAvailable: jest.fn()
}))
jest.mock('@/modules/upload/NewItemHighlightProvider', () => ({
  useNewItemHighlightContext: jest.fn()
}))

describe('UploadItem', () => {
  const setup = (props = {}) =>
    render(<UploadItem onClick={jest.fn()} {...props} />)

  beforeEach(() => {
    useClient.mockReturnValue({})
    useDispatch.mockReturnValue(jest.fn())
    useAlert.mockReturnValue({ showAlert: jest.fn() })
    useI18n.mockReturnValue({ t: key => key })
    useDisplayedFolder.mockReturnValue({ initialDirId: 'dir' })
    useNewItemHighlightContext.mockReturnValue({ addItems: jest.fn() })
    isDirectoryPickerAvailable.mockReturnValue(true)
  })

  it('keeps the file entry on a plain file picker', () => {
    const { getByTestId } = setup()

    expect(getByTestId('upload-btn').hasAttribute('webkitdirectory')).toBe(
      false
    )
  })

  it('renders the folder entry on a directory picker', () => {
    const { getByTestId, queryByText } = setup({ isDirectory: true })

    expect(
      getByTestId('upload-folder-btn').hasAttribute('webkitdirectory')
    ).toBe(true)
    expect(queryByText('toolbar.menu_upload_folder')).toBeInTheDocument()
  })

  it('does not render the folder entry in a read-only folder', () => {
    const { queryByTestId } = setup({ isDirectory: true, isReadOnly: true })

    expect(queryByTestId('upload-folder-btn')).toBe(null)
  })

  it('does not render the folder entry where the picker is unavailable', () => {
    isDirectoryPickerAvailable.mockReturnValue(false)
    const { queryByTestId } = setup({ isDirectory: true })

    expect(queryByTestId('upload-folder-btn')).toBe(null)
  })
})
