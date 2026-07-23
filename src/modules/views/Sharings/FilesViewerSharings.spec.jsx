import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

import { useQuery } from 'cozy-client'
import { useSharingContext } from 'cozy-sharing'

import FilesViewerSharings from './FilesViewerSharings'
import { SharingsTabProvider } from './useSharingsTab'

import { SHARING_TAB_BY_ME, SHARING_TAB_WITH_ME } from '@/constants/config'

const mockNavigate = jest.fn()

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate
}))
jest.mock('cozy-client/dist/hooks/useQuery', () => jest.fn())
jest.mock('cozy-sharing', () => ({
  useSharingContext: jest.fn()
}))
jest.mock('./withSharedDocumentIds', () => Component => {
  const React = require('react')
  const WithSharedDocumentIds = props =>
    React.createElement(Component, {
      ...props,
      sharedDocumentIds: ['file-owned', 'file-received']
    })
  return WithSharedDocumentIds
})
jest.mock('@/modules/viewer/FilesViewer', () => {
  const React = require('react')
  const FilesViewer = ({ files, onClose, onChange }) =>
    React.createElement(
      React.Fragment,
      null,
      React.createElement(
        'div',
        { 'data-testid': 'viewer-files' },
        files.map(f => f._id).join(',')
      ),
      React.createElement(
        'button',
        { onClick: () => onClose() },
        'close-viewer'
      ),
      React.createElement(
        'button',
        { onClick: () => onChange('file-owned') },
        'change-file'
      )
    )
  return FilesViewer
})

const ownedFile = { _id: 'file-owned', id: 'file-owned', type: 'file' }
const receivedFile = { _id: 'file-received', id: 'file-received', type: 'file' }
const someDirectory = { _id: 'dir-1', id: 'dir-1', type: 'directory' }

const setup = ({
  route = `/sharings/with-me/file/${receivedFile._id}`,
  path = '/sharings/with-me/file/:fileId',
  tab = SHARING_TAB_WITH_ME
} = {}) =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route
          path={path}
          element={
            <SharingsTabProvider tab={tab}>
              <FilesViewerSharings />
            </SharingsTabProvider>
          }
        />
      </Routes>
    </MemoryRouter>
  )

describe('FilesViewerSharings', () => {
  beforeEach(() => {
    useQuery.mockReturnValue({
      data: [ownedFile, receivedFile, someDirectory]
    })
    useSharingContext.mockReturnValue({
      isOwner: id => id === ownedFile._id
    })
  })

  it('pages only through the files of the active tab at the sharings root', () => {
    setup()

    expect(screen.getByTestId('viewer-files').textContent).toBe(
      receivedFile._id
    )
  })

  it('pages only through owned files on the by-me tab', () => {
    setup({
      route: `/sharings/by-me/file/${ownedFile._id}`,
      path: '/sharings/by-me/file/:fileId',
      tab: SHARING_TAB_BY_ME
    })

    expect(screen.getByTestId('viewer-files').textContent).toBe(ownedFile._id)
  })

  it('closes the viewer to the active tab route', () => {
    setup({ route: `/sharings/with-me/file/${receivedFile._id}?sort=name` })

    fireEvent.click(screen.getByText('close-viewer'))

    expect(mockNavigate).toHaveBeenCalledWith({
      pathname: '/sharings/with-me',
      search: '?sort=name'
    })
  })

  it('changes files within the active tab route', () => {
    setup({ route: `/sharings/with-me/file/${receivedFile._id}?sort=name` })

    fireEvent.click(screen.getByText('change-file'))

    expect(mockNavigate).toHaveBeenCalledWith({
      pathname: `/sharings/with-me/file/${ownedFile._id}`,
      search: '?sort=name'
    })
  })

  it('does not tab-filter the viewer inside a shared folder', () => {
    // A folder belongs wholly to one tab, and its nested files are unknown
    // to the sharing context (isOwner would misclassify them), so the tab
    // filter only applies at the sharings root.
    setup({
      route: `/sharings/with-me/folder/folder-1/file/${receivedFile._id}`,
      path: '/sharings/with-me/folder/:folderId/file/:fileId'
    })

    expect(screen.getByTestId('viewer-files').textContent).toBe(
      `${ownedFile._id},${receivedFile._id}`
    )

    fireEvent.click(screen.getByText('close-viewer'))
    expect(mockNavigate).toHaveBeenCalledWith({
      pathname: '/sharings/with-me/folder/folder-1',
      search: ''
    })
  })
})
