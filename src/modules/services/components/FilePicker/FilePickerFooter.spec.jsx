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
        onClearSelection={jest.fn()}
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

it('offers the documents action alone when it is the only one configured', () => {
  const client = createMockClient({})
  const onConfirm = jest.fn()

  const { getByTestId, queryByTestId } = render(
    <AppLike client={client}>
      <FilePickerFooter
        onConfirm={onConfirm}
        onClearSelection={jest.fn()}
        documentsState={{ disabled: false, reasonKey: null }}
        documentsAction={{ label: 'Add to the conversation' }}
      />
    </AppLike>
  )

  expect(queryByTestId('public-link-btn')).toBe(null)
  expect(queryByTestId('temporary-download-link-btn')).toBe(null)
  const button = getByTestId('documents-btn')
  expect(button).toHaveTextContent('Add to the conversation')
  expect(button).not.toHaveClass('u-ml-1')

  button.click()
  expect(onConfirm).toHaveBeenCalledWith(filePickerLinkModes.DOCUMENTS)
})
