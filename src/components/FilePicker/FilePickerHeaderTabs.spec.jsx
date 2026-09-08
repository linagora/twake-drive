import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'

import { useI18n } from 'twake-i18n'

import { FilePickerHeaderTabs } from './FilePickerHeaderTabs'
import { filePickerSections } from './constants'

jest.mock('twake-i18n')
jest.mock('@linagora/twake-icons', () => ({
  Cloud2: 'cloud',
  Icon: ({ icon }) => <span>{icon}</span>,
  ShareExternal: 'share'
}))
jest.mock('cozy-ui/transpiled/react/Tabs', () => ({ children, onChange }) => (
  <div role="tablist">
    {React.Children.map(children, child => (
      <button type="button" onClick={() => onChange(null, child.props.value)}>
        {child.props.label}
      </button>
    ))}
  </div>
))
jest.mock('cozy-ui/transpiled/react/Tab', () => props => <span {...props} />)

describe('FilePickerHeaderTabs', () => {
  beforeEach(() => {
    useI18n.mockReturnValue({ t: key => key })
  })

  afterEach(() => jest.clearAllMocks())

  it.each([
    [filePickerSections.DRIVE, ['Nav.item_drive']],
    [filePickerSections.SHARINGS, ['Nav.item_sharings']],
    [
      filePickerSections.DRIVE,
      ['Nav.item_drive', 'Nav.item_sharings'],
      [filePickerSections.DRIVE, filePickerSections.SHARINGS]
    ]
  ])(
    'renders only the available tabs',
    (activeSection, labels, availableSections = [activeSection]) => {
      render(
        <FilePickerHeaderTabs
          activeSection={activeSection}
          availableSections={availableSections}
          onSectionChange={jest.fn()}
        />
      )

      expect(screen.getAllByRole('button')).toHaveLength(labels.length)
      labels.forEach(label =>
        expect(screen.getByText(label)).toBeInTheDocument()
      )
    }
  )

  it('forwards a tab change without exposing unavailable sections', () => {
    const onSectionChange = jest.fn()
    render(
      <FilePickerHeaderTabs
        activeSection={filePickerSections.DRIVE}
        availableSections={Object.values(filePickerSections)}
        onSectionChange={onSectionChange}
      />
    )

    fireEvent.click(screen.getAllByRole('button')[1])

    expect(onSectionChange).toHaveBeenCalledWith(filePickerSections.RECENTS)
  })
})
