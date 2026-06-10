import { render, screen } from '@testing-library/react'
import React from 'react'
import { Route, Routes } from 'react-router-dom'

import CozyClient from 'cozy-client'
import flag from 'cozy-flags'

import FileOpenerExternal from './FileOpenerExternal'
import AppLike from 'test/components/AppLike'

jest.mock('@/components/FilesRealTimeQueries', () => ({
  ensureFileHasPath: jest.fn().mockImplementation(file => Promise.resolve(file))
}))

jest.mock('cozy-flags', () => {
  const flags = {}
  const flag = jest.fn((name, value) => {
    if (value !== undefined) {
      flags[name] = value
    }
    return flags[name] ?? null
  })
  return { __esModule: true, default: flag }
})

const mockViewer = jest.fn(() => <div>Viewer</div>)

jest.mock('cozy-viewer', () => ({
  ...jest.requireActual('cozy-viewer'),
  __esModule: true,
  default: props => mockViewer(props)
}))

const docxFile = {
  _id: 'file-docx-id',
  id: 'file-docx-id',
  _type: 'io.cozy.files',
  type: 'file',
  name: 'Rapport.docx',
  class: 'text',
  mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  path: '/Rapport.docx'
}

const pdfFile = {
  _id: 'file-pdf-id',
  id: 'file-pdf-id',
  _type: 'io.cozy.files',
  type: 'file',
  name: 'Rapport.pdf',
  class: 'pdf',
  mime: 'application/pdf',
  path: '/Rapport.pdf'
}

describe('FileOpenerExternal', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    flag('drive.office.enabled', true)
    flag('drive.office.touchScreen.enabled', true)
  })

  afterEach(() => {
    flag('drive.office.enabled', null)
    flag('drive.office.touchScreen.enabled', null)
  })

  const setup = ({ file }) => {
    const client = new CozyClient({})
    client.query = jest.fn().mockResolvedValue({ data: file })
    window.location.hash = `#/file/${file._id}`

    return render(
      <AppLike client={client}>
        <Routes>
          <Route path="/file/:fileId" element={<FileOpenerExternal />} />
          <Route
            path="/onlyoffice/:fileId"
            element={<div>OnlyOffice editor</div>}
          />
        </Routes>
      </AppLike>
    )
  }

  it('redirects an Office file straight to the OnlyOffice editor', async () => {
    setup({ file: docxFile })

    expect(await screen.findByText('OnlyOffice editor')).toBeInTheDocument()
    expect(mockViewer).not.toHaveBeenCalled()
  })

  it('renders the viewer for a non Office file', async () => {
    setup({ file: pdfFile })

    expect(await screen.findByText('Viewer')).toBeInTheDocument()
  })

  it('renders the viewer for an Office file when Office is disabled', async () => {
    flag('drive.office.enabled', false)
    flag('drive.office.touchScreen.enabled', false)

    setup({ file: docxFile })

    expect(await screen.findByText('Viewer')).toBeInTheDocument()
  })
})
