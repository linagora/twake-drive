import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'

import { useClient } from 'cozy-client'
import { useSharingContext } from 'cozy-sharing'
import { useAlert } from 'cozy-ui/transpiled/react/providers/Alert'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'

import SharingInvitations from './SharingInvitations'
import { useSharingsQueryResult } from './useSharingsQueryResult'

import { ROUTER_FUTURE_FLAGS } from '@/constants/config'
import { useFileLink } from '@/modules/navigation/hooks/useFileLink'

jest.mock('cozy-client', () => ({
  ...jest.requireActual('cozy-client'),
  useClient: jest.fn()
}))
jest.mock('cozy-sharing', () => ({ useSharingContext: jest.fn() }))
jest.mock('cozy-ui/transpiled/react/providers/Alert', () => ({
  useAlert: jest.fn()
}))
jest.mock('cozy-ui/transpiled/react/providers/Breakpoints', () => ({
  __esModule: true,
  default: jest.fn(() => ({ isMobile: false }))
}))
jest.mock('twake-i18n', () => ({
  useI18n: () => ({
    t: (key, params) => (params ? `${key}[${params.name}]` : key)
  })
}))
jest.mock('@/modules/navigation/hooks/useFileLink', () => ({
  useFileLink: jest.fn()
}))
jest.mock('./useSharingsQueryResult', () => ({
  useSharingsQueryResult: jest.fn()
}))
jest.mock('@/modules/filelist/icons/SharingShortcutIcon', () => ({
  SharingShortcutIcon: () => null
}))

function makeShortcut(id, { status = 'new' } = {}) {
  return {
    _id: id,
    _rev: `1-${id}`,
    _type: 'io.cozy.files',
    name: `${id}.url`,
    created_at: `2026-10-0${id.slice(-1)}T00:00:00Z`,
    metadata: {
      sharing: { status },
      target: { _type: 'io.cozy.files' }
    }
  }
}

function setup(files, pathname = '/folder') {
  const deleteFilePermanently = jest.fn().mockResolvedValue({})
  const client = {
    save: jest.fn().mockResolvedValue({}),
    collection: jest.fn(() => ({ deleteFilePermanently })),
    dispatch: jest.fn(),
    generateRandomId: jest.fn(() => 'random-id')
  }
  useClient.mockReturnValue(client)
  useSharingContext.mockReturnValue({
    allLoaded: true,
    byDocId: {},
    getOwner: () => ({ public_name: 'Alice' })
  })
  useSharingsQueryResult.mockReturnValue({ data: files })
  useAlert.mockReturnValue({ showAlert: jest.fn() })
  const openLink = jest.fn()
  useFileLink.mockReturnValue({ openLink })

  const view = render(<SharingInvitations />, {
    wrapper: ({ children }) => (
      <MemoryRouter initialEntries={[pathname]} future={ROUTER_FUTURE_FLAGS}>
        {children}
      </MemoryRouter>
    )
  })
  return { ...view, client, deleteFilePermanently, openLink }
}

// MidEllipsis splits the name in two spans wrapped with left-to-right marks
function getDisplayedText() {
  return (
    screen.queryByTestId('sharing-invitations')?.textContent ?? ''
  ).replaceAll('\u200E', '')
}

describe('SharingInvitations', () => {
  it('renders nothing without new invitations', () => {
    setup([makeShortcut('s1', { status: 'seen' })])

    expect(screen.queryByTestId('sharing-invitations')).toBe(null)
  })

  it('renders nothing in the embedded space', () => {
    setup([makeShortcut('s1')], '/embed/sharings/drive-id/folder-id')

    expect(screen.queryByTestId('sharing-invitations')).toBe(null)
  })

  it('shows the 4 oldest new invitations and hides the others', () => {
    setup(['s5', 's4', 's3', 's2', 's1'].map(id => makeShortcut(id)))

    expect(getDisplayedText()).toContain('SharingInvitations.text[s1]')
    expect(getDisplayedText()).toContain('SharingInvitations.text[s4]')
    expect(getDisplayedText()).not.toContain('SharingInvitations.text[s5]')
  })

  it('reveals the next invitation once a visible one is handled', () => {
    const files = ['s1', 's2', 's3', 's4', 's5'].map(id => makeShortcut(id))
    const { rerender } = setup(files)

    useSharingsQueryResult.mockReturnValue({
      data: [makeShortcut('s1', { status: 'seen' }), ...files.slice(1)]
    })
    rerender(<SharingInvitations />)

    expect(getDisplayedText()).not.toContain('SharingInvitations.text[s1]')
    expect(getDisplayedText()).toContain('SharingInvitations.text[s5]')
  })

  it('shows the invitation text on mobile', () => {
    useBreakpoints.mockReturnValueOnce({ isMobile: true })
    setup([makeShortcut('s1')])

    expect(getDisplayedText()).toContain('SharingInvitations.text[s1]')
  })

  it('marks the invitation as seen when closed', async () => {
    const { client } = setup([makeShortcut('s1')])

    fireEvent.click(screen.getByLabelText('SharingInvitations.close'))

    await waitFor(() =>
      expect(client.save).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: 's1',
          _rev: '1-s1',
          metadata: {
            sharing: { status: 'seen' },
            target: { _type: 'io.cozy.files' }
          }
        })
      )
    )
  })

  it('opens the sharing and marks it as seen when accepted', async () => {
    const { client, openLink } = setup([makeShortcut('s1')])

    fireEvent.click(screen.getByText('SharingInvitations.accept'))

    expect(openLink).toHaveBeenCalled()
    await waitFor(() => expect(client.save).toHaveBeenCalled())
  })

  it('permanently deletes the shortcut and removes it from the store when declined', async () => {
    const { client, deleteFilePermanently } = setup([makeShortcut('s1')])

    fireEvent.click(screen.getByText('SharingInvitations.decline'))

    await waitFor(() =>
      expect(client.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          response: { data: expect.objectContaining({ _deleted: true }) }
        })
      )
    )
    expect(deleteFilePermanently).toHaveBeenCalledWith('s1')
  })
})
