import { render, screen, waitFor } from '@testing-library/react'
import { format } from 'date-fns'
import React from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import CozyClient, { CozyProvider } from 'cozy-client'
import { useSharingContext } from 'cozy-sharing'
import AlertProvider from 'cozy-ui/transpiled/react/providers/Alert'
import { BreakpointsProvider } from 'cozy-ui/transpiled/react/providers/Breakpoints'
import CozyTheme from 'cozy-ui-plus/dist/providers/CozyTheme'
import { I18n } from 'twake-i18n'

import FileHistory from '.'
import { setupStore } from 'test/setup'

import { ROUTER_FUTURE_FLAGS } from '@/constants/config'
import { schema } from '@/lib/doctypes'
import enLocale from '@/locales/en.json'

jest.mock('cozy-sharing', () => ({
  useSharingContext: jest.fn()
}))

const OLDER_VERSION_DATE = '2026-07-26T09:00:00.000Z'
const NEWER_VERSION_DATE = '2026-07-27T09:00:00.000Z'

const makeVersion = (id, updatedAt) => ({
  type: 'io.cozy.files.versions',
  id,
  attributes: { size: '1000', updated_at: updatedAt, tags: [] },
  meta: { rev: '1-abc' }
})

const makeFileResponse = ({ versions = [] } = {}) => ({
  data: {
    type: 'io.cozy.files',
    id: 'file-id',
    attributes: {
      type: 'file',
      name: 'report.pdf',
      dir_id: 'dir-id',
      size: '3000',
      updated_at: '2026-07-28T09:00:00.000Z'
    },
    meta: { rev: '3-ghi' },
    relationships: versions.length
      ? {
          old_versions: {
            data: versions.map(({ id, type }) => ({ id, type }))
          }
        }
      : {}
  },
  included: versions
})

const formatHistoryDate = date => format(new Date(date), 'dd LLLL - HH:mm')

const findRowTexts = () =>
  screen
    .getAllByTestId('history-row-download')
    .map(button => button.closest('li').textContent)

const renderFileHistory = ({ path, fileResponse }) => {
  const client = new CozyClient({ schema, useCustomStore: true })
  client.getStackClient().setUri('http://test.cloud')
  setupStore({ client })
  const fetchJSON = jest
    .spyOn(client.getStackClient(), 'fetchJSON')
    .mockImplementation(async (method, url) => {
      if (
        url === '/files/file-id' ||
        url === '/sharings/drives/drive-id/file-id'
      ) {
        return fileResponse
      }
      if (url.includes('/_find')) {
        return { docs: [], next: false }
      }
      return { data: [] }
    })

  render(
    <CozyTheme>
      <CozyProvider client={client}>
        <I18n lang="en" dictRequire={() => enLocale}>
          <BreakpointsProvider>
            <AlertProvider>
              <MemoryRouter
                future={ROUTER_FUTURE_FLAGS}
                initialEntries={[path]}
              >
                <Routes>
                  <Route path="/file/:fileId" element={<FileHistory />} />
                  <Route
                    path="/drive/:driveId/file/:fileId"
                    element={<FileHistory />}
                  />
                </Routes>
              </MemoryRouter>
            </AlertProvider>
          </BreakpointsProvider>
        </I18n>
      </CozyProvider>
    </CozyTheme>
  )

  return { fetchJSON }
}

const hasRequestedVersionsDoctype = fetchJSON =>
  fetchJSON.mock.calls.some(([, url]) =>
    url.includes('/data/io.cozy.files.versions/')
  )

describe('FileHistory', () => {
  beforeEach(() => {
    useSharingContext.mockReturnValue({ hasWriteAccess: () => false })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('lists the old versions of a shared drive file, newest first', async () => {
    renderFileHistory({
      path: '/drive/drive-id/file/file-id',
      fileResponse: makeFileResponse({
        versions: [
          makeVersion('file-id/1-older', OLDER_VERSION_DATE),
          makeVersion('file-id/2-newer', NEWER_VERSION_DATE)
        ]
      })
    })

    await waitFor(() => {
      expect(screen.getAllByTestId('history-row-download')).toHaveLength(3)
    })
    const [, firstVersionRow, secondVersionRow] = findRowTexts()
    expect(firstVersionRow).toContain(formatHistoryDate(NEWER_VERSION_DATE))
    expect(secondVersionRow).toContain(formatHistoryDate(OLDER_VERSION_DATE))
  })

  it('shows only the current version of a shared drive file without old versions', async () => {
    renderFileHistory({
      path: '/drive/drive-id/file/file-id',
      fileResponse: makeFileResponse()
    })

    expect(await screen.findByText('report.pdf')).toBeInTheDocument()
    expect(screen.getAllByTestId('history-row-download')).toHaveLength(1)
  })

  it("does not look for the versions of a shared drive file on the member's instance", async () => {
    const { fetchJSON } = renderFileHistory({
      path: '/drive/drive-id/file/file-id',
      fileResponse: makeFileResponse({
        versions: [makeVersion('file-id/1-older', OLDER_VERSION_DATE)]
      })
    })

    await waitFor(() => {
      expect(screen.getAllByTestId('history-row-download')).toHaveLength(2)
    })
    expect(hasRequestedVersionsDoctype(fetchJSON)).toBe(false)
  })

  it('keeps reading the versions of a personal file from the instance', async () => {
    const { fetchJSON } = renderFileHistory({
      path: '/file/file-id',
      fileResponse: makeFileResponse()
    })

    expect(await screen.findByText('report.pdf')).toBeInTheDocument()
    await waitFor(() => {
      expect(hasRequestedVersionsDoctype(fetchJSON)).toBe(true)
    })
  })
})
