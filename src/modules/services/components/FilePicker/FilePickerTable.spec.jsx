import { act, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'

import { useBreakpoints } from 'cozy-ui/transpiled/react/providers/Breakpoints'
import { useI18n } from 'twake-i18n'

import { FilePickerTable } from './FilePickerTable'

jest.mock('twake-i18n')
jest.mock('./FilePickerTableCell', () => ({
  FilePickerTableCell: () => null
}))
jest.mock('cozy-ui/transpiled/react/providers/Breakpoints', () => ({
  useBreakpoints: jest.fn()
}))
jest.mock('cozy-ui/transpiled/react/Table/Virtualized', () => {
  const React = require('react')
  const VirtualizedTable = React.forwardRef(
    ({ rows, context, components, isSelectedItem }, ref) => {
      const TableRow = components.TableRow
      return (
        <div data-testid="virtuoso-scroller">
          <table ref={ref}>
            <tbody>
              {rows.map(row => (
                <TableRow
                  key={row._id}
                  item={row}
                  context={{ ...context, isSelectedItem }}
                />
              ))}
            </tbody>
          </table>
        </div>
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

function setup({ isMobile = false, tableItems = items } = {}) {
  const onItemClick = jest.fn()
  const onItemToggle = jest.fn()
  const onItemDoubleClick = jest.fn()
  useBreakpoints.mockReturnValue({ isMobile })
  useI18n.mockReturnValue({ t: key => key })

  const view = render(
    <FilePickerTable
      items={tableItems}
      itemsIdsSelected={[]}
      isItemDisabled={item => item._id === 'pending-id'}
      onItemClick={onItemClick}
      onItemToggle={onItemToggle}
      onItemDoubleClick={onItemDoubleClick}
    />
  )

  return { ...view, onItemClick, onItemToggle, onItemDoubleClick }
}

describe('FilePickerTable', () => {
  afterEach(() => {
    jest.clearAllMocks()
    jest.useRealTimers()
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

  it('preserves the virtual scroller while a long list is enriched', () => {
    const initialItems = Array.from({ length: 100 }, (_, index) => ({
      _id: `file-${index}`,
      name: `File ${index}`
    }))
    const enrichedItems = [
      { _id: 'federated-file', name: 'Federated file' },
      ...initialItems
    ]
    const props = {
      itemsIdsSelected: [],
      isItemDisabled: () => false,
      onItemClick: jest.fn(),
      onItemToggle: jest.fn(),
      onItemDoubleClick: jest.fn()
    }
    const { rerender } = setup({ tableItems: initialItems })
    const scroller = screen.getByTestId('virtuoso-scroller')
    scroller.scrollTop = 480

    rerender(<FilePickerTable {...props} items={enrichedItems} />)

    expect(screen.getByTestId('virtuoso-scroller')).toBe(scroller)
    expect(scroller.scrollTop).toBe(480)
    expect(screen.getAllByTestId('list-item')).toHaveLength(101)
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
})
