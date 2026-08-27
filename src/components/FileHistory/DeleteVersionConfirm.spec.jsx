import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'

import { CozyProvider } from 'cozy-client'
import AlertProvider from 'cozy-ui/transpiled/react/providers/Alert'
import { BreakpointsProvider } from 'cozy-ui/transpiled/react/providers/Breakpoints'
import CozyTheme from 'cozy-ui-plus/dist/providers/CozyTheme'
import { I18n } from 'twake-i18n'

import { DeleteVersionConfirm } from './DeleteVersionConfirm'
import { setupStoreAndClient } from 'test/setup'

import enLocale from '@/locales/en.json'

const FILE = { _id: 'file-id', name: 'report.pdf' }
const VERSION = {
  _id: 'file-id/2-fa3a3bec',
  id: 'file-id/2-fa3a3bec',
  size: '2400',
  updated_at: '2026-07-28T09:17:00.000Z'
}

const renderDeleteVersionConfirm = ({ fetchJSON }) => {
  const { client } = setupStoreAndClient()
  const onClose = jest.fn()
  jest.spyOn(client.getStackClient(), 'fetchJSON').mockImplementation(fetchJSON)

  render(
    <CozyTheme>
      <CozyProvider client={client}>
        <I18n lang="en" dictRequire={() => enLocale}>
          <BreakpointsProvider>
            <AlertProvider>
              <DeleteVersionConfirm
                file={FILE}
                version={VERSION}
                onClose={onClose}
              />
            </AlertProvider>
          </BreakpointsProvider>
        </I18n>
      </CozyProvider>
    </CozyTheme>
  )

  return { client, onClose }
}

describe('DeleteVersionConfirm', () => {
  it('deletes the version through the stack and closes', async () => {
    const fetchJSON = jest.fn().mockResolvedValue(null)
    const { onClose } = renderDeleteVersionConfirm({ fetchJSON })

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => {
      expect(fetchJSON).toHaveBeenCalledWith(
        'DELETE',
        '/files/file-id/2-fa3a3bec'
      )
    })
    expect(onClose).toHaveBeenCalled()
  })

  it('warns the user and stays open when the version could not be deleted', async () => {
    const fetchJSON = jest.fn().mockRejectedValue(new Error('nope'))
    const { onClose } = renderDeleteVersionConfirm({ fetchJSON })

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    expect(
      await screen.findByText('This version could not be deleted.')
    ).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('closes without deleting anything when cancelled', async () => {
    const fetchJSON = jest.fn().mockResolvedValue(null)
    const { onClose } = renderDeleteVersionConfirm({ fetchJSON })

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(fetchJSON).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })
})
