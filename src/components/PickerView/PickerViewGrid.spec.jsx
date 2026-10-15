import { fireEvent, render, screen } from '@testing-library/react'
import React, { useRef, useState } from 'react'

import { BreakpointsProvider } from 'cozy-ui/transpiled/react/providers/Breakpoints'

import { PickerView } from './PickerView'
import { TestI18n } from 'test/components/AppLike'

import { useFilePickerAdapter } from '@/components/FilePicker/useFilePickerAdapter'
import { SelectionProvider } from '@/modules/selection/SelectionProvider'

jest.mock('@/modules/filelist/icons/FileThumbnail', () => () => null)
jest.mock('cozy-ui/transpiled/react/GridList/Virtualized', () => ({
  __esModule: true,
  default: require('test/components/VirtualizedGridMock').VirtualizedGridMock
}))

const items = [
  {
    _id: 'first',
    type: 'file',
    name: 'First.pdf',
    path: '/Projects/First.pdf'
  },
  { _id: 'disabled', type: 'file', name: 'Unavailable.pdf' },
  { _id: 'last', type: 'file', name: 'Last.pdf' }
]
const isItemDisabled = item => item._id === 'disabled'

function GridSelection() {
  const selectionContainerRef = useRef(null)
  const [openedItem, setOpenedItem] = useState(null)
  const adapter = useFilePickerAdapter({
    items,
    viewType: 'grid',
    multiple: true,
    canSelectItem: item => !isItemDisabled(item),
    selectionContainerRef,
    onFileDoubleClick: item => setOpenedItem(item.name)
  })
  return (
    <>
      <output>{openedItem}</output>
      <PickerView
        viewType="grid"
        items={items}
        selectionContainerRef={selectionContainerRef}
        selectedItemIds={adapter.selectedItemIds}
        onItemClick={adapter.onItemClick}
        onItemToggle={adapter.onItemToggle}
        onItemDoubleClick={adapter.onItemDoubleClick}
        isItemDisabled={isItemDisabled}
        getItemDisabledReason={item =>
          isItemDisabled(item) ? 'Move.destinationReadOnly' : null
        }
        withFilePath
        beforeItems={<div>Create folder</div>}
      />
    </>
  )
}

function setup(props = null) {
  window.innerWidth = 1024
  return render(
    <TestI18n>
      <BreakpointsProvider>
        <SelectionProvider clearOnLocationChange={false}>
          {props ? (
            <PickerView viewType="grid" {...props} />
          ) : (
            <GridSelection />
          )}
        </SelectionProvider>
      </BreakpointsProvider>
    </TestI18n>
  )
}

describe('PickerView grid', () => {
  it('renders existing filenames, paths and disabled reasons without permitting disabled activation', () => {
    setup()
    const disabledItem = screen.getByRole('button', { name: /Unavailable.pdf/ })
    expect(disabledItem).toHaveAttribute('aria-disabled', 'true')
    expect(disabledItem).toHaveAccessibleName(/read.only/i)
    expect(screen.queryByText('/Projects')).toBeInTheDocument()
    expect(screen.queryByText('Create folder')).toBeInTheDocument()
    fireEvent.click(disabledItem)
    fireEvent.doubleClick(disabledItem)
    expect(fireEvent.keyDown(disabledItem, { key: 'Enter' })).toBe(false)
    expect(disabledItem).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('status').textContent).toBe('')
    expect(screen.queryByRole('button', { name: 'First.pdf' })).toHaveAttribute(
      'aria-pressed',
      'false'
    )
  })

  it('skips disabled items for range selection and select-all, and activates the real file with Enter', () => {
    setup()
    const first = screen.getByRole('button', { name: 'First.pdf' })
    const last = screen.getByRole('button', { name: 'Last.pdf' })
    fireEvent.click(first)
    fireEvent.keyDown(document, { key: 'ArrowRight', shiftKey: true })
    expect(first).toHaveAttribute('aria-pressed', 'true')
    expect(last).toHaveAttribute('aria-pressed', 'true')
    expect(
      screen.getByRole('button', { name: /Unavailable.pdf/ })
    ).toHaveAttribute('aria-pressed', 'false')
    fireEvent.keyDown(document, { key: 'a', ctrlKey: true })
    expect(first).toHaveAttribute('aria-pressed', 'false')
    expect(last).toHaveAttribute('aria-pressed', 'false')
    fireEvent.keyDown(document, { key: 'a', ctrlKey: true })
    expect(first).toHaveAttribute('aria-pressed', 'true')
    expect(last).toHaveAttribute('aria-pressed', 'true')
    expect(
      screen.getByRole('button', { name: /Unavailable.pdf/ })
    ).toHaveAttribute('aria-pressed', 'false')
    expect(fireEvent.keyDown(first, { key: 'Enter' })).toBe(false)
    expect(screen.getByRole('status')).toHaveTextContent('First.pdf')
  })

  it.each(['Escape', ' '])(
    'leaves %s available without activating the grid item',
    key => {
      setup()
      const first = screen.getByRole('button', { name: 'First.pdf' })
      expect(fireEvent.keyDown(first, { key })).toBe(true)
      expect(screen.getByRole('status')).toBeEmptyDOMElement()
      expect(first).toHaveAttribute('aria-pressed', 'false')
    }
  )

  it('leaves Enter available when no activation is configured', () => {
    setup({ items, isItemDisabled })
    const first = screen.getByRole('button', { name: 'First.pdf' })
    expect(fireEvent.keyDown(first, { key: 'Enter' })).toBe(true)
    expect(first).toHaveAttribute('aria-pressed', 'false')
  })

  it.each(['loaded', 'loading', 'failed'])(
    'preserves empty, loading and source-error states in grid: %s',
    fetchStatus => {
      setup({ items: [], fetchStatus, beforeItems: <div>Create folder</div> })
      expect(screen.queryByTestId('grid-item')).toBe(null)
      const states = {
        loaded: 'file-picker-empty',
        loading: 'file-picker-loading',
        failed: 'file-picker-source-error'
      }
      expect(screen.queryByTestId(states[fetchStatus])).toBeInTheDocument()
      for (const [state, testId] of Object.entries(states)) {
        if (state !== fetchStatus)
          expect(screen.queryByTestId(testId)).toBe(null)
      }
      if (fetchStatus !== 'loading')
        expect(screen.queryByText('Create folder')).toBeInTheDocument()
    }
  )

  it('keeps existing items visible during pagination and displays the progress', () => {
    setup({ items, isFetchingMore: true, fetchStatus: 'loading' })
    expect(
      screen.queryByRole('button', { name: 'First.pdf' })
    ).toBeInTheDocument()
    expect(screen.queryByTestId('file-picker-loading-more')).toBeInTheDocument()
    expect(screen.queryByTestId('file-picker-loading')).toBe(null)
  })
})
