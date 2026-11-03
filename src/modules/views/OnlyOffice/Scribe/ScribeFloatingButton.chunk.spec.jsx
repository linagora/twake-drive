import { act, render, screen } from '@testing-library/react'
import React from 'react'

import { createMockClient } from 'cozy-client'
import flag from 'cozy-flags'

import AppLike from 'test/components/AppLike'

import logger from '@/lib/logger'
import { OnlyOfficeContext } from '@/modules/views/OnlyOffice/OnlyOfficeProvider'
import { ScribeFloatingButton } from '@/modules/views/OnlyOffice/Scribe/ScribeFloatingButton'
import {
  useScribe,
  useScribeGeometry
} from '@/modules/views/OnlyOffice/Scribe/ScribeProvider'

jest.mock('cozy-flags')
jest.mock('@/lib/logger', () => ({ warn: jest.fn() }))
jest.mock('@/modules/views/OnlyOffice/Scribe/ScribeProvider', () => ({
  useScribe: jest.fn(),
  useScribeGeometry: jest.fn()
}))
// As a chunk that a deploy has replaced
jest.mock('@/modules/views/OnlyOffice/Scribe/ScribeButtonMark', () => {
  throw new Error('Loading chunk 42 failed')
})

describe('ScribeFloatingButton without the chunk of its mark', () => {
  it('stays, without its mark, and the app with it', async () => {
    flag.mockImplementation(name => name === 'cozy.assistant.enabled')
    useScribe.mockReturnValue({
      isAvailable: true,
      isOpen: false,
      documentType: 'word',
      open: jest.fn()
    })
    useScribeGeometry.mockReturnValue(null)

    render(
      <AppLike client={createMockClient({})}>
        <OnlyOfficeContext.Provider
          value={{ isPublic: false, isReadOnly: false }}
        >
          <ScribeFloatingButton />
        </OnlyOfficeContext.Provider>
      </AppLike>
    )
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    expect(
      screen.getByRole('button', { name: 'Scribe Panel' })
    ).toBeInTheDocument()
    expect(screen.queryByTestId('scribe-button-mark')).toBe(null)
    expect(logger.warn).toHaveBeenCalled()
  })
})
