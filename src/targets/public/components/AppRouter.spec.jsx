// app.test.js
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import React from 'react'

import { createMockClient } from 'cozy-client'

import AppRouter from './AppRouter'
import AppLike from 'test/components/AppLike'

import { isExcalidrawEnabled } from '@/modules/views/Excalidraw/helpers'
import { isOfficeEnabled } from '@/modules/views/OnlyOffice/helpers'

const client = createMockClient({})

jest.mock('modules/views/OnlyOffice/helpers', () => ({
  ...jest.requireActual('modules/views/OnlyOffice/helpers'),
  isOfficeEnabled: jest.fn().mockImplementation(() => true)
}))

jest.mock('modules/views/Excalidraw/helpers', () => ({
  ...jest.requireActual('modules/views/Excalidraw/helpers'),
  isExcalidrawEnabled: jest.fn().mockImplementation(() => true)
}))

jest.mock('modules/views/Excalidraw', () => {
  return jest.fn().mockImplementation(() => {
    return <div>ExcalidrawView</div>
  })
})

jest.mock('modules/upload/UploadQueue')

jest.mock('@/components/FilesRealTimeQueries', () => ({
  __esModule: true,
  default: () => null
}))

jest.mock('modules/views/Public/PublicFolderView', () => ({
  PublicFolderView: jest.fn().mockImplementation(() => {
    return <div>PublicFolderView</div>
  })
}))

jest.mock('modules/public/LightFileViewer', () => {
  return jest.fn().mockImplementation(() => {
    return <div>LightFileViewer</div>
  })
})

jest.mock('modules/views/OnlyOffice', () => {
  return jest.fn().mockImplementation(() => {
    return <div>OnlyOfficeView</div>
  })
})

describe('Public AppRouter', () => {
  beforeEach(() => {
    isOfficeEnabled.mockImplementation(() => true)
  })

  // AppLike mounts a HashRouter: a pathname would leave every render on '/'.
  const setupRouter = ({ route = '/', data = {} } = {}) => {
    window.location.hash = `#${route}`
    render(
      <AppLike client={client}>
        <AppRouter history={history} data={data} />
      </AppLike>
    )
  }

  it('should display the folder view when accessing something other than a file', async () => {
    setupRouter()

    expect(screen.getByText('PublicFolderView')).toBeInTheDocument()
  })

  it('should render viewer when accessing a file', async () => {
    setupRouter({ data: { type: 'file' } })

    expect(screen.getByText('LightFileViewer')).toBeInTheDocument()
  })

  const textDocument = {
    id: 'doc-id',
    _type: 'io.cozy.files',
    name: 'document.docx',
    type: 'file',
    class: 'text',
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  }

  it('should render onlyoffice view when accessing a document file with /', async () => {
    setupRouter({ data: textDocument })

    expect(screen.getByText('OnlyOfficeView')).toBeInTheDocument()
  })

  it('should render onlyoffice view when  accessing a document file with /onlyofficeid', async () => {
    setupRouter({ data: textDocument, route: '/onlyoffice/id' })

    expect(screen.getByText('OnlyOfficeView')).toBeInTheDocument()
  })

  it('should render OnlyOffice for a public PDF when Office is enabled', () => {
    setupRouter({
      data: {
        id: 'pdf-id',
        name: 'contract.pdf',
        type: 'file',
        class: 'pdf',
        mime: 'application/pdf'
      }
    })

    expect(screen.queryByText('OnlyOfficeView')).toBeInTheDocument()
    expect(screen.queryByText('LightFileViewer')).toBe(null)
  })

  it('should keep the public PDF viewer when Office is disabled', () => {
    isOfficeEnabled.mockImplementation(() => false)
    setupRouter({
      data: {
        id: 'pdf-id',
        name: 'contract.pdf',
        type: 'file',
        class: 'pdf',
        mime: 'application/pdf'
      }
    })

    expect(screen.queryByText('OnlyOfficeView')).toBe(null)
    expect(screen.queryByText('LightFileViewer')).toBeInTheDocument()
  })

  it('should redirect onlyoffice route to file viewer if office is disabled', async () => {
    isOfficeEnabled.mockImplementation(() => false)

    setupRouter({ data: textDocument, route: '/onlyoffice/id' })

    expect(screen.getByText('LightFileViewer')).toBeInTheDocument()
  })

  it('should render the excalidraw view when a shared folder page targets a drawing', async () => {
    setupRouter({ route: '/excalidraw/file-id' })

    expect(await screen.findByText('ExcalidrawView')).toBeInTheDocument()
  })

  it('should redirect the excalidraw route to the folder view when excalidraw is disabled', async () => {
    isExcalidrawEnabled.mockImplementation(() => false)

    setupRouter({ route: '/excalidraw/file-id' })

    expect(screen.getByText('PublicFolderView')).toBeInTheDocument()
  })
})
