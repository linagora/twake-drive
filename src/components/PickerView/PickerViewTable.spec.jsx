import { act, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'

import { useBreakpoints } from 'cozy-ui/transpiled/react/providers/Breakpoints'
import { useI18n } from 'twake-i18n'

import { PickerViewTable } from './PickerViewTable'

jest.mock('twake-i18n')
jest.mock('cozy-ui/transpiled/react/providers/Breakpoints', () => ({
  useBreakpoints: jest.fn()
}))
jest.mock('@/modules/filelist/icons/FileThumbnail', () => () => (
  <div data-testid="file-thumbnail">Thumbnail</div>
))
jest.mock('cozy-ui/transpiled/react/Table/Virtualized', () => {
  const React = require('react')
  const VirtualizedTable = React.forwardRef(
    ({ rows, context, components, isSelectedItem, selectedItems }, ref) => {
      const TableRow = components.TableRow
      const TableBody = components.TableBody
      return (
        <table ref={ref}>
          <TableBody context={context}>
            {rows.map(row => (
              <TableRow
                key={row._id}
                item={row}
                context={{ ...context, isSelectedItem, selectedItems }}
              />
            ))}
          </TableBody>
        </table>
      )
    }
  )
  VirtualizedTable.displayName = 'VirtualizedTable'
  return { __esModule: true, default: VirtualizedTable }
})

const items = [
  { _id: 'enabled-id', name: 'Enabled' },
  { _id: 'pending-id', name: 'Pending' }
]

function setup({
  isMobile = false,
  itemsIdsSelected = [],
  beforeItems = null
} = {}) {
  const onItemClick = jest.fn()
  const onItemToggle = jest.fn()
  const onItemDoubleClick = jest.fn()
  useBreakpoints.mockReturnValue({ isMobile })
  useI18n.mockReturnValue({ t: key => key })

  render(
    <PickerViewTable
      items={items}
      itemsIdsSelected={itemsIdsSelected}
      beforeItems={beforeItems}
      isItemDisabled={item => item._id === 'pending-id'}
      getItemDisabledReason={item =>
        item._id === 'pending-id' ? 'Move.destinationReadOnly' : null
      }
      onItemClick={onItemClick}
      onItemToggle={onItemToggle}
      onItemDoubleClick={onItemDoubleClick}
    />
  )

  return { onItemClick, onItemToggle, onItemDoubleClick }
}

describe('PickerViewTable', () => {
  afterEach(() => {
    jest.clearAllMocks()
    jest.useRealTimers()
  })

  it('renders beforeItems as the first row below the table header', () => {
    setup({ beforeItems: <div data-testid="before-items">Create folder</div> })

    const beforeRow = screen.getByTestId('picker-view-before-items')
    const firstItemRow = screen.getAllByTestId('list-item')[0]

    expect(beforeRow.parentElement.firstElementChild).toBe(beforeRow)
    expect(beforeRow.compareDocumentPosition(firstItemRow)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    )
  })

  it('marks selected rows based purely on controlled itemsIdsSelected prop', () => {
    setup({ itemsIdsSelected: ['enabled-id'] })
    const [enabledRow, pendingRow] = screen.getAllByTestId('list-item')

    expect(enabledRow).toHaveClass('Mui-selected')
    expect(pendingRow).not.toHaveClass('Mui-selected')
  })

  it('exposes the disabled reason in the row accessible name', () => {
    setup()

    expect(screen.getAllByTestId('list-item')[1]).toHaveAccessibleName(
      'Pending. Move.destinationReadOnly'
    )
  })

  it('blocks click and double-click on disabled rows', () => {
    const { onItemClick, onItemDoubleClick } = setup()
    const [enabledRow, pendingRow] = screen.getAllByTestId('list-item')

    expect(pendingRow).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(pendingRow)
    fireEvent.doubleClick(pendingRow)
    expect(onItemClick).not.toHaveBeenCalled()
    expect(onItemDoubleClick).not.toHaveBeenCalled()

    fireEvent.click(enabledRow)
    fireEvent.doubleClick(enabledRow)
    expect(onItemClick).toHaveBeenCalledTimes(1)
    expect(onItemDoubleClick).toHaveBeenCalledTimes(1)
  })

  it('blocks mobile tap and long press on disabled rows', () => {
    jest.useFakeTimers()
    const { onItemClick, onItemToggle } = setup({ isMobile: true })
    const pendingRow = screen.getAllByTestId('list-item')[1]

    fireEvent.touchStart(pendingRow)
    act(() => jest.advanceTimersByTime(300))
    fireEvent.touchEnd(pendingRow)
    fireEvent.click(pendingRow)

    expect(onItemClick).not.toHaveBeenCalled()
    expect(onItemToggle).not.toHaveBeenCalled()
  })

  it('triggers onItemToggle on mobile long press on enabled row', () => {
    jest.useFakeTimers()
    const { onItemClick, onItemToggle } = setup({ isMobile: true })
    const enabledRow = screen.getAllByTestId('list-item')[0]

    fireEvent.touchStart(enabledRow)
    act(() => jest.advanceTimersByTime(300))
    fireEvent.touchEnd(enabledRow)
    fireEvent.click(enabledRow)

    expect(onItemToggle).toHaveBeenCalledWith(items[0], expect.anything())
    expect(onItemClick).not.toHaveBeenCalled()
  })
})
