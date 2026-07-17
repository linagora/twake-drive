import { renderHook, act } from '@testing-library/react'
import React from 'react'

import { createMockClient } from 'cozy-client'

import { useMoreMenuActions } from './useMoreMenuActions'
import AppLike from 'test/components/AppLike'

jest.mock('cozy-intent', () => ({
  useWebviewIntent: jest.fn()
}))

const file = {
  _id: 'file-1',
  id: 'file-1',
  _type: 'io.cozy.files',
  type: 'file',
  name: 'report.txt',
  mime: 'text/plain',
  dir_id: 'folder-1',
  driveId: 'drive-1'
}

const setup = async ({ hasWriteAccess }) => {
  const client = createMockClient({})
  const hasWriteAccessMock = jest.fn().mockReturnValue(hasWriteAccess)
  const sharingContextValue = {
    refresh: jest.fn(),
    hasWriteAccess: hasWriteAccessMock,
    isOwner: jest.fn(),
    allLoaded: true,
    byDocId: {}
  }

  const wrapper = ({ children }) => (
    <AppLike client={client} sharingContextValue={sharingContextValue}>
      {children}
    </AppLike>
  )

  const rendered = renderHook(() => useMoreMenuActions(file), { wrapper })
  // Flush the print-availability effect so its state update stays inside act.
  await act(async () => {})
  return { ...rendered, hasWriteAccessMock }
}

const findAction = (actions, name) =>
  actions.find(action => action[name])?.[name]

describe('useMoreMenuActions', () => {
  it('does not display duplicateTo without write access to the folder', async () => {
    const { result, hasWriteAccessMock } = await setup({
      hasWriteAccess: false
    })

    const duplicateTo = findAction(result.current, 'duplicateTo')
    expect(duplicateTo.displayCondition([file])).toBe(false)
    // Write access must be resolved with the file's driveId so proxied
    // shared drive files are checked against the drive sharing.
    expect(hasWriteAccessMock).toHaveBeenCalledWith(null, 'drive-1')
  })

  it('displays duplicateTo with write access to the folder', async () => {
    const { result } = await setup({ hasWriteAccess: true })

    const duplicateTo = findAction(result.current, 'duplicateTo')
    expect(duplicateTo.displayCondition([file])).toBe(true)
  })
})
