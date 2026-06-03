// app.test.js
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import React from 'react'

import { createMockClient } from 'cozy-client'

import AppRouter from './AppRouter'
import AppLike from 'test/components/AppLike'

import { isOfficeEnabled } from '@/modules/views/OnlyOffice/helpers'

const client = createMockClient({})

jest.mock('modules/views/OnlyOffice/helpers', () => ({
  ...jest.requireActual('modules/views/OnlyOffice/helpers'),
  isOfficeEnabled: jest.fn().mockImplementation(() => true)
}))

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
  const setupRouter = ({ route = '/', data = {} } = {}) => {
    window.history.pushState({}, 'Test page', route)
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

  const textDocument = { name: 'document.docs', type: 'file', class: 'text' }

  it('should render onlyoffice view when accessing a document file with /', async () => {
    setupRouter({ data: textDocument })

    expect(screen.getByText('OnlyOfficeView')).toBeInTheDocument()
  })

  it('should render onlyoffice view when  accessing a document file with /onlyofficeid', async () => {
    setupRouter({ data: textDocument, route: '/onlyoffice/id' })

    expect(screen.getByText('OnlyOfficeView')).toBeInTheDocument()
  })

  it('should redirect onlyoffice route to file viewer if office is disabled', async () => {
    isOfficeEnabled.mockImplementation(() => false)

    setupRouter({ data: textDocument, route: '/onlyoffice/id' })

    expect(screen.getByText('LightFileViewer')).toBeInTheDocument()
  })
})
