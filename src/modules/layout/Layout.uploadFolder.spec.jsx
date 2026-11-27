import { fireEvent, render, screen, within } from '@testing-library/react'
import React from 'react'
import { Route, Routes } from 'react-router-dom'
import { createStore } from 'redux'

import { createMockClient } from 'cozy-client'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'

import Layout from './Layout'
import AppLike from 'test/components/AppLike'

import { ROOT_DIR_ID } from '@/constants/config'
import { uploadFiles } from '@/modules/navigation/duck'

jest.mock('cozy-flags', () => jest.fn(() => false))
jest.mock('cozy-bar', () => ({ BarComponent: () => null }))
jest.mock('cozy-devtools', () => () => null)
jest.mock('cozy-flags/dist/FlagSwitcher', () => () => null)
jest.mock('cozy-ui-plus/dist/Storage', () => () => null)
jest.mock('@/components/pushClient/Button', () => () => null)
jest.mock('@/components/FilesRealTimeQueries', () => () => null)
jest.mock('@/modules/navigation/Nav', () => () => null)
jest.mock('@/modules/upload', () => ({
  ...jest.requireActual('@/modules/upload'),
  isDirectoryPickerAvailable: () => true
}))
jest.mock('@/modules/upload/UploadQueue', () => () => null)
jest.mock('@/hooks/useCurrentFolderWriteAccess', () => jest.fn(() => true))
jest.mock('@/hooks', () => ({
  useDisplayedFolder: () => ({ displayedFolder: null })
}))
jest.mock('@/modules/navigation/duck', () => ({
  uploadFiles: jest.fn(() => ({ type: 'UPLOAD_FILES' }))
}))
jest.mock('@/modules/navigation/duck/reducer', () => ({
  wasOperationRedirected: () => false,
  RESET_OPERATION_REDIRECTED: 'RESET_OPERATION_REDIRECTED'
}))
jest.mock('cozy-ui/transpiled/react/providers/Breakpoints', () => {
  const actual = jest.requireActual(
    'cozy-ui/transpiled/react/providers/Breakpoints'
  )
  return {
    ...actual,
    __esModule: true,
    default: jest.fn()
  }
})

describe('Layout sidebar folder upload button', () => {
  const store = createStore(() => ({}))
  const client = createMockClient({ store })
  client.store = store
  const file = new File(['content'], 'a.txt')

  const renderAt = hash => {
    window.location.hash = hash
    render(
      <AppLike client={client} store={store}>
        <Routes>
          <Route path="shareddrive/:driveId/:folderId" element={<Layout />} />
          <Route path="*" element={<Layout />} />
        </Routes>
      </AppLike>
    )
  }

  const pickFolder = () =>
    fireEvent.change(screen.getByTestId('upload-folder-btn'), {
      target: { files: [file] }
    })

  beforeEach(() => {
    useBreakpoints.mockReturnValue({ isDesktop: true, isMobile: false })
  })

  afterEach(() => {
    window.location.hash = ''
    jest.clearAllMocks()
  })

  it('uploads a folder picked from a shared drive into that drive', () => {
    renderAt('#/shareddrive/drive-id/folder-id')

    pickFolder()

    expect(uploadFiles).toHaveBeenCalledTimes(1)
    const [files, dirId, , , , driveId] = uploadFiles.mock.calls[0]
    expect(files).toEqual([file])
    expect(dirId).toBe('folder-id')
    expect(driveId).toBe('drive-id')
  })

  it('uploads to the root and opens it from a view without a folder', () => {
    renderAt('#/recent')

    pickFolder()

    expect(uploadFiles.mock.calls[0][1]).toBe(null)
    expect(window.location.hash).toBe(`#/folder/${ROOT_DIR_ID}`)
  })

  it.each(['#/shareddrive/drive-id/folder-id', '#/recent'])(
    'keeps the entry out of the Create menu on %s',
    async hash => {
      renderAt(hash)

      fireEvent.click(screen.getByRole('button', { name: 'Create' }))

      const menu = await screen.findByRole('menu')
      expect(within(menu).queryByText('Upload folder')).toBe(null)
    }
  )
})
