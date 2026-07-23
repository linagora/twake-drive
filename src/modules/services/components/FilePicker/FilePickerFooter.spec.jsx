import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'

import FilePickerFooter from './FilePickerFooter'
import { filePickerActions, filePickerLinkModes } from './constants'

jest.mock('twake-i18n', () => ({
  useI18n: () => ({ t: key => key.split('.').at(-1) })
}))

jest.mock('@/modules/selection/SelectionProvider', () => ({
  useSelectionContext: () => ({
    selectedItems: [],
    clearSelection: jest.fn()
  })
}))

const enabledState = { disabled: false, reasonKey: null }

const enabledActions = filePickerActions.map(action => ({
  ...action,
  actionConfig: {},
  state: enabledState
}))

const setup = (props = {}) =>
  render(
    <FilePickerFooter
      onConfirm={jest.fn()}
      actions={enabledActions}
      {...props}
    />
  )

describe('FilePickerFooter', () => {
  it('renders configured actions in footer order with their default labels', () => {
    setup()

    expect(
      screen.getAllByRole('button').map(button => button.dataset.testid)
    ).toEqual([
      'reference-btn',
      'temporary-download-link-btn',
      'public-link-btn'
    ])
    expect(screen.queryByTestId('reference-btn')).toHaveTextContent('reference')
    expect(
      screen.queryByTestId('temporary-download-link-btn')
    ).toHaveTextContent('temporaryDownloadLink')
    expect(screen.queryByTestId('public-link-btn')).toHaveTextContent(
      'publicLink'
    )
  })

  it('hides unconfigured actions and displays a custom label', () => {
    setup({
      actions: enabledActions.map(action => ({
        ...action,
        actionConfig:
          action.configKey === 'sharingLink' ? { label: 'Share file' } : null
      }))
    })

    expect(screen.queryByTestId('reference-btn')).toBe(null)
    expect(screen.queryByTestId('temporary-download-link-btn')).toBe(null)
    expect(screen.queryByTestId('public-link-btn')).toHaveTextContent(
      'Share file'
    )
  })

  it('disables an action according to its state', () => {
    setup({
      actions: enabledActions.map(action =>
        action.configKey === 'downloadLink'
          ? { ...action, state: { disabled: true, reasonKey: null } }
          : action
      )
    })

    expect(screen.queryByTestId('temporary-download-link-btn')).toBeDisabled()
  })

  it.each([
    ['reference-btn', filePickerLinkModes.REFERENCE],
    [
      'temporary-download-link-btn',
      filePickerLinkModes.TEMPORARY_DOWNLOAD_LINK
    ],
    ['public-link-btn', filePickerLinkModes.PUBLIC_LINK]
  ])('emits the mode associated with %s', (testId, mode) => {
    const onConfirm = jest.fn()
    setup({
      onConfirm,
      actions: enabledActions.filter(action => action.mode === mode)
    })

    fireEvent.click(screen.getByTestId(testId))

    expect(onConfirm).toHaveBeenCalledWith(mode)
  })
})
