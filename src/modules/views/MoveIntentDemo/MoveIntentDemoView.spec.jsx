import { fireEvent, render, screen, waitFor, act } from '@testing-library/react'
import React from 'react'

import { createMockClient } from 'cozy-client'
import { Intents } from 'cozy-interapp'

import { MoveIntentDemoView } from './MoveIntentDemoView'
import AppLike from 'test/components/AppLike'

jest.mock('cozy-interapp', () => ({ Intents: jest.fn() }))

const source = {
  _id: 'source-id',
  _type: 'io.cozy.files',
  type: 'file',
  name: 'Source.txt'
}
const directory = {
  _id: 'folder-id',
  _type: 'io.cozy.files',
  type: 'directory',
  name: 'Folder',
  path: '/Folder'
}

function getOpenButton() {
  return screen.getByRole('button', { name: 'Open MOVE demo' })
}

describe('MoveIntentDemoView', () => {
  let finish
  let start
  let create

  beforeEach(async () => {
    jest.spyOn(console, 'warn').mockImplementation(message => {
      if (!message.startsWith('Be carful to use `withBreakpoints()`'))
        throw new Error(message)
    })
    jest.spyOn(console, 'error').mockImplementation((...args) => {
      const message = args.join(' ')
      const knownMainWarning =
        message.includes('Invalid prop `children`') &&
        message.includes('supplied to `Main`')
      const knownNonclosableWarning =
        message.includes('Invalid prop `onClose` of type `boolean`') &&
        /ForwardRef\((Dialog|Modal)\)/.test(message)
      if (!knownMainWarning && !knownNonclosableWarning)
        throw new Error(message)
    })
    start = jest.fn((element, callbacks) => {
      callbacks.onReady()
      callbacks.onReadyToUse()
      return new Promise(resolve => {
        finish = resolve
      })
    })
    create = jest.fn(() => ({ start }))
    Intents.mockImplementation(() => ({ create }))
    await act(async () => {
      render(
        <AppLike client={createMockClient({})}>
          <MoveIntentDemoView />
        </AppLike>
      )
    })
  })

  afterEach(() => jest.restoreAllMocks())

  async function selectDocuments(label, documents) {
    fireEvent.click(screen.getByRole('button', { name: label }))
    const removeIntentIframe = jest.fn()
    await act(async () => finish({ document: documents, removeIntentIframe }))
    expect(removeIntentIframe).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBe(null))
  }

  it('keeps the destructive warning without editable IDs, source count or acknowledgment', () => {
    expect(screen.queryByRole('alert')).toHaveTextContent(
      'This demo really moves your files.'
    )
    expect(screen.queryByLabelText('Source file IDs')).toBe(null)
    expect(screen.queryByLabelText('Default directory ID')).toBe(null)
    expect(screen.queryByText(/Selected sources:/)).toBe(null)
    expect(screen.queryByRole('checkbox', { name: /I understand/ })).toBe(null)
    expect(
      JSON.parse(screen.getByTestId('move-demo-options').textContent)
    ).toEqual({ fileIds: [] })
    expect(getOpenButton()).toBeDisabled()
    expect(create).not.toHaveBeenCalled()
  })

  it('chooses local files through PICK and sends their IDs to MOVE without extra acknowledgment', async () => {
    await selectDocuments('Choose local files', [source])
    expect(create).toHaveBeenLastCalledWith(
      'PICK',
      'io.cozy.files',
      expect.objectContaining({
        multiple: true,
        tabs: ['drive'],
        documents: { accept: ['file'] },
        sharingLink: null,
        downloadLink: null
      })
    )
    expect(screen.queryByTestId('move-demo-sources')).toHaveTextContent(
      'Source.txt'
    )
    expect(screen.queryByText('source-id')).toBe(null)
    expect(getOpenButton()).toBeEnabled()
    fireEvent.click(getOpenButton())
    expect(create).toHaveBeenLastCalledWith(
      'MOVE',
      'io.cozy.files',
      expect.objectContaining({ fileIds: ['source-id'] })
    )
    expect(create.mock.lastCall[2]).not.toHaveProperty('defaultDirId')
    expect(create.mock.lastCall[2]).not.toHaveProperty('theme')
    expect(create.mock.lastCall[2]).not.toHaveProperty('tabs')
  })

  it('uses a single-folder My Drive PICK and supplies its ID as the restricted initial directory', async () => {
    await selectDocuments('Choose local files', [source])
    fireEvent.click(
      screen.getByRole('checkbox', { name: /Restrict destinations/ })
    )
    expect(getOpenButton()).toBeDisabled()
    expect(
      screen.queryByText('Choose a default folder to restrict destinations.')
    ).toBeInTheDocument()
    await selectDocuments('Choose default folder', [directory])
    expect(create).toHaveBeenLastCalledWith(
      'PICK',
      'io.cozy.files',
      expect.objectContaining({
        multiple: false,
        tabs: ['drive'],
        documents: { accept: ['folder'] },
        sharingLink: null,
        downloadLink: null
      })
    )
    expect(screen.queryByTestId('move-demo-directory')).toHaveTextContent(
      '/Folder'
    )
    expect(screen.queryByText('folder-id')).toBe(null)
    fireEvent.click(screen.getByLabelText('Drive only'))
    fireEvent.click(screen.getByLabelText('Dark'))
    fireEvent.click(getOpenButton())
    expect(
      JSON.parse(screen.getByTestId('move-demo-options').textContent)
    ).toEqual({
      fileIds: ['source-id'],
      defaultDirId: 'folder-id',
      restrictToDefaultDir: true,
      tabs: ['drive'],
      theme: { type: 'dark' }
    })
    expect(create).toHaveBeenLastCalledWith(
      'MOVE',
      'io.cozy.files',
      expect.objectContaining({
        fileIds: ['source-id'],
        defaultDirId: 'folder-id',
        restrictToDefaultDir: true,
        tabs: ['drive'],
        theme: { type: 'dark' }
      })
    )
  })

  it('keeps the chosen folder on PICK cancellation and can clear it', async () => {
    await selectDocuments('Choose local files', [source])
    await selectDocuments('Choose default folder', [directory])
    fireEvent.click(
      screen.getByRole('button', { name: 'Choose default folder' })
    )
    await act(async () => finish(null))
    expect(screen.queryByTestId('move-demo-directory')).toHaveTextContent(
      '/Folder'
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Clear default folder' })
    )
    expect(screen.queryByTestId('move-demo-directory')).toBe(null)
    fireEvent.click(getOpenButton())
    expect(create.mock.lastCall[2]).not.toHaveProperty('defaultDirId')
  })

  it('keeps selected sources when source PICK is cancelled', async () => {
    await selectDocuments('Choose local files', [source])
    fireEvent.click(screen.getByRole('button', { name: 'Choose local files' }))
    await act(async () => finish(null))
    expect(screen.queryByTestId('move-demo-sources')).toHaveTextContent(
      'Source.txt'
    )
    expect(getOpenButton()).toBeEnabled()
  })

  it.each(
    [
      [source],
      [directory, directory],
      [],
      null,
      [{ ...directory, driveId: 'remote-drive' }],
      [{ ...directory, cozyMetadata: { createdByApp: 'nextcloud' } }]
    ].map(documents => [documents])
  )('rejects invalid default directory results: %j', async documents => {
    await selectDocuments('Choose local files', [source])
    await selectDocuments('Choose default folder', [directory])
    fireEvent.click(
      screen.getByRole('checkbox', { name: /Restrict destinations/ })
    )
    await selectDocuments('Choose default folder', documents)
    expect(screen.queryByTestId('move-demo-directory')).toBe(null)
    expect(screen.queryByText(/Choose one local folder\./)).toBeInTheDocument()
    expect(getOpenButton()).toBeDisabled()
  })

  it.each([
    { type: 'directory' },
    { driveId: 'remote-drive' },
    { orgDrive: 'remote-drive' },
    { _type: 'io.cozy.remote.nextcloud.files' },
    { cozyMetadata: { createdByApp: 'nextcloud' } }
  ])('rejects non-local or non-file source results: %j', async invalid => {
    await selectDocuments('Choose local files', [{ ...source, ...invalid }])
    expect(
      screen.queryByText(/Choose only local files for MOVE\./)
    ).toBeInTheDocument()
    expect(getOpenButton()).toBeDisabled()
    expect(screen.queryByTestId('move-demo-result')).toBe(null)
  })

  it('uses the nonclosable opener, renders completion and clears sources for a new operation', async () => {
    await selectDocuments('Choose local files', [source])
    fireEvent.click(getOpenButton())
    await screen.findByRole('dialog')
    expect(screen.queryByRole('button', { name: 'Close', exact: true })).toBe(
      null
    )
    fireEvent.keyDown(screen.getByRole('dialog'), {
      key: 'Escape',
      code: 'Escape'
    })
    expect(screen.queryByRole('dialog')).toBeInTheDocument()
    expect(screen.queryByTestId('move-demo-result')).toBe(null)
    const documents = [
      { ...source, _id: 'new-id', path: '/Destination/Source.txt' }
    ]
    await act(async () => finish({ document: documents }))
    expect(
      JSON.parse(screen.getByTestId('move-demo-result').textContent)
    ).toEqual(documents)
    expect(screen.queryByTestId('move-demo-outcome')).toHaveTextContent(
      'Completed. Returned files: 1.'
    )
    expect(screen.queryByTestId('move-demo-sources')).toBe(null)
    expect(getOpenButton()).toBeDisabled()
    expect(
      JSON.parse(screen.getByTestId('move-demo-options').textContent)
    ).toEqual({ fileIds: ['source-id'] })
    fireEvent.click(screen.getByRole('button', { name: 'Choose local files' }))
    expect(screen.queryByTestId('move-demo-outcome')).toBe(null)
    expect(
      JSON.parse(screen.getByTestId('move-demo-options').textContent)
    ).toEqual({ fileIds: [] })
  })

  it('reports cancellation without claiming rollback or returning partial results', async () => {
    await selectDocuments('Choose local files', [source])
    fireEvent.click(getOpenButton())
    await act(async () => finish(null))
    expect(screen.queryByRole('dialog')).toBe(null)
    expect(screen.queryByTestId('move-demo-result')).toBe(null)
    expect(screen.queryByTestId('move-demo-outcome')).toHaveTextContent(
      'Cancelled; no result returned. Completed moves, if any, remain.'
    )
    expect(
      JSON.parse(screen.getByTestId('move-demo-options').textContent)
    ).toEqual({ fileIds: ['source-id'] })
  })

  it('keeps fatal errors visible with documented reload recovery', async () => {
    await selectDocuments('Choose local files', [source])
    start.mockImplementation(() =>
      Promise.reject(new Error('Source no longer available'))
    )
    fireEvent.click(getOpenButton())
    expect(
      await screen.findByText('Source no longer available')
    ).toBeInTheDocument()
    expect(screen.queryByTestId('move-demo-result')).toBe(null)
    expect(
      screen.queryByText(/A terminal error is displayed/)
    ).toBeInTheDocument()
  })
})
