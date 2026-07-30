import { render } from '@testing-library/react'
import React from 'react'

import { createMockClient } from 'cozy-client'
import IntentDialogOpener from 'cozy-ui-plus/dist/Intent/IntentDialogOpener'

import { FilePickerButton } from './FilePickerButton'
import AppLike from 'test/components/AppLike'

jest.mock('cozy-ui-plus/dist/Intent/IntentDialogOpener', () => ({
  __esModule: true,
  default: jest.fn(({ children }) => children)
}))

const client = createMockClient()

describe('FilePickerButton', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it.each([true, false])('sets full-screen dialog to %s', isMobile => {
    window.innerWidth = isMobile ? 500 : 1024

    render(
      <AppLike client={client}>
        <FilePickerButton />
      </AppLike>
    )

    expect(IntentDialogOpener).toHaveBeenCalledWith(
      expect.objectContaining({ fullScreen: isMobile }),
      expect.anything()
    )
  })
})
