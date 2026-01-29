import { render, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'

import { AddFolder } from './AddFolder'
import AppLike from 'test/components/AppLike'
import { setupStoreAndClient } from 'test/setup'

jest.mock('modules/navigation/duck/actions', () => ({
  createFolder: jest.fn(() => async () => {})
}))

jest.mock('lib/logger', () => ({
  error: jest.fn()
}))

jest.mock('cozy-flags', () => jest.fn())
jest.mock('cozy-keys-lib', () => ({
  withVaultClient: jest.fn().mockReturnValue({}),
  useVaultClient: jest.fn(),
  WebVaultClient: jest.fn().mockReturnValue({})
}))

describe('AddFolder', () => {
  const setup = () => {
    const { client, store } = setupStoreAndClient({})

    const onSubmit = jest.fn()

    const container = render(
      <AppLike client={client} store={store}>
        <AddFolder visible onSubmit={onSubmit} />
      </AppLike>
    )
    return { container, onSubmit }
  }

  it('should call onSubmit with folder name', async () => {
    const { container, onSubmit } = setup()

    const input = await container.findByRole('textbox')
    await waitFor(async () => {
      fireEvent.change(input, { target: { value: 'Mes photos de chat' } })
      input.blur()
    })

    expect(onSubmit).toHaveBeenCalledWith(
      'Mes photos de chat',
      expect.anything(),
      expect.anything()
    )
  })
})
