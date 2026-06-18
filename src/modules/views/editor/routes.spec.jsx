import { render, screen } from '@testing-library/react'
import React from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

const mockFlag = jest.fn()

jest.mock('cozy-flags', () => ({
  __esModule: true,
  default: (...args) => mockFlag(...args)
}))

jest.mock('@/modules/views/Excalidraw/routes', () => ({
  getExcalidrawRoutes: () => (
    <Route path="excalidraw/:fileId" element={<div>excalidraw-view</div>} />
  )
}))

jest.mock('@/modules/views/OnlyOffice/routes', () => ({
  getOnlyOfficeRoutes: () => (
    <Route path="onlyoffice/:fileId" element={<div>onlyoffice-view</div>} />
  )
}))

jest.mock('@/modules/views/Pdf/routes', () => ({
  getPdfRoutes: () => <Route path="pdf/:fileId" element={<div>pdf-view</div>} />
}))

import { getEditorRoutes } from './routes'

const renderAt = (path, flags = {}) => {
  mockFlag.mockImplementation(name => Boolean(flags[name]))
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        {getEditorRoutes()}
        <Route path="*" element={<div>no-match</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('getEditorRoutes', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('always mounts OnlyOffice routes regardless of flags', () => {
    renderAt('/onlyoffice/123')

    expect(screen.getByText('onlyoffice-view')).toBeInTheDocument()
  })

  it('mounts Excalidraw routes when the flag is enabled', () => {
    renderAt('/excalidraw/123', { 'drive.excalidraw.enabled': true })

    expect(screen.getByText('excalidraw-view')).toBeInTheDocument()
  })

  it('does not mount Excalidraw routes when the flag is disabled', () => {
    renderAt('/excalidraw/123', { 'drive.excalidraw.enabled': false })

    expect(screen.queryByText('excalidraw-view')).toBe(null)
    expect(screen.getByText('no-match')).toBeInTheDocument()
  })

  it('mounts PDF routes when the flag is enabled', () => {
    renderAt('/pdf/123', { 'drive.pdf-editor.enabled': true })

    expect(screen.getByText('pdf-view')).toBeInTheDocument()
  })
})
