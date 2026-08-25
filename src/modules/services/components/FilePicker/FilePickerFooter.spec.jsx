import { render } from '@testing-library/react'
import React from 'react'

import { createMockClient } from 'cozy-client'

import FilePickerFooter from './FilePickerFooter'
import { filePickerLinkModes } from './constants'
import AppLike from 'test/components/AppLike'

it('shows the attachment action as busy while confirming', () => {
  const client = createMockClient({})

  const { getByTestId } = render(
    <AppLike client={client}>
      <FilePickerFooter
        onConfirm={jest.fn()}
        downloadLinkState={{ disabled: false, reasonKey: null }}
        downloadLinkAction={{ label: 'Add as attachment' }}
        busyLinkMode={filePickerLinkModes.TEMPORARY_DOWNLOAD_LINK}
      />
    </AppLike>
  )

  const button = getByTestId('temporary-download-link-btn')
  expect(button).toBeDisabled()
  expect(button.querySelector('.twake-icon--spin')).toBeInTheDocument()
})
