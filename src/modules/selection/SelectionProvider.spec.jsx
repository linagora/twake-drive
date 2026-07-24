import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import { Provider } from 'react-redux'
import {
  MemoryRouter,
  Routes,
  Route,
  Link,
  useLocation
} from 'react-router-dom'
import { createStore } from 'redux'

import { generateFile } from 'test/generate'

import {
  SelectionProvider,
  useSelectionContext
} from '@/modules/selection/SelectionProvider'

jest.mock('modules/upload/NewItemHighlightProvider', () => ({
  ...jest.requireActual('modules/upload/NewItemHighlightProvider'),
  useNewItemHighlightContext: () => ({
    addItems: jest.fn()
  })
}))

// Create a mock store for testing
const mockStore = createStore(() => ({
  // Add any state that SelectionProvider needs
  upload: {
    queue: [],
    newItems: []
  }
}))

const SelectionConsumer = ({ items }) => {
  const {
    showSelectionBar,
    hideSelectionBar,
    isSelectionBarVisible,
    toggleSelectedItem,
    isItemSelected
  } = useSelectionContext()
  const { pathname } = useLocation()

  return (
    <>
      {pathname === '/sharings/with-me' && (
        <Link to="/other">Change route</Link>
      )}
      {pathname === '/sharings/with-me' && (
        <Link to="/sharings/by-me">Change tab</Link>
      )}
      {isSelectionBarVisible && (
        <button onClick={hideSelectionBar}>Hide selection bar</button>
      )}
      {items.map((item, index) => (
        <button
          onClick={() => toggleSelectedItem(item)}
          key={item.id}
          data-testid={`item-${index + 1}`}
        >
          {`Item ${item.id} ${isItemSelected(item.id) ? 'selected' : ''}`}
        </button>
      ))}
      <button onClick={showSelectionBar}>Show selection bar</button>
    </>
  )
}

describe('SelectionProvider', () => {
  const item1 = generateFile({ i: 1 })
  const item2 = generateFile({ i: 2 })
  const item3 = generateFile({ i: 3 })
  const items = [item1, item2, item3]

  const setup = () => {
    return render(
      <Provider store={mockStore}>
        <MemoryRouter initialEntries={['/sharings/with-me']}>
          <SelectionProvider>
            <Routes>
              <Route
                path="/sharings/with-me"
                element={<SelectionConsumer items={items} />}
              />
              <Route
                path="/other"
                element={<SelectionConsumer items={items} />}
              />
              <Route
                path="/sharings/by-me"
                element={<SelectionConsumer items={items} />}
              />
            </Routes>
          </SelectionProvider>
        </MemoryRouter>
      </Provider>
    )
  }

  it('show and hide the selection bar', async () => {
    setup()

    expect(screen.queryByText('Hide selection bar')).toBeNull()

    fireEvent.click(screen.getByText('Show selection bar'))
    await waitFor(async () => {
      const hideButton = await screen.findByText('Hide selection bar')
      expect(hideButton).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Hide selection bar'))
    expect(screen.queryByText('Hide selection bar')).toBeNull()
  })

  it('select and deselects item', () => {
    setup()

    // selecting one item
    fireEvent.click(screen.getByText('Item file-foobar1'))
    expect(screen.getByText('Item file-foobar1 selected')).toBeInTheDocument()
    expect(screen.getByText('Item file-foobar2')).toBeInTheDocument()
    expect(screen.getByText('Hide selection bar')).toBeInTheDocument()

    // selecting a second item
    fireEvent.click(screen.getByText('Item file-foobar2'))
    expect(screen.getByText('Item file-foobar1 selected')).toBeInTheDocument()
    expect(screen.getByText('Item file-foobar2 selected')).toBeInTheDocument()
    expect(screen.getByText('Hide selection bar')).toBeInTheDocument()

    // deselecting the first item
    fireEvent.click(screen.getByText('Item file-foobar1 selected'))
    expect(screen.getByText('Item file-foobar1')).toBeInTheDocument()
    expect(screen.getByText('Item file-foobar2 selected')).toBeInTheDocument()
    expect(screen.getByText('Hide selection bar')).toBeInTheDocument()

    // deselecting the second item
    fireEvent.click(screen.getByText('Item file-foobar2 selected'))
    expect(screen.getByText('Item file-foobar1')).toBeInTheDocument()
    expect(screen.getByText('Item file-foobar2')).toBeInTheDocument()
    expect(screen.queryByText('Hide selection bar')).toBeNull()
  })

  it('should deselect items when a tab route changes', async () => {
    setup()

    // selecting an item
    fireEvent.click(screen.getByText('Item file-foobar1'))
    expect(screen.getByText('Item file-foobar1 selected')).toBeInTheDocument()
    expect(screen.getByText('Hide selection bar')).toBeInTheDocument()

    // Sharings tabs are separate routes, so switching tabs changes location.
    fireEvent.click(screen.getByText('Change tab'))

    await waitFor(async () => {
      expect(await screen.findByText('Item file-foobar1')).toBeInTheDocument()
      expect(screen.queryByText('Hide selection bar')).toBeNull()
    })
  })

  it('should deselects items when location changed', async () => {
    setup()

    // show selection bar
    fireEvent.click(screen.getByText('Show selection bar'))
    const hideButton = await screen.findByText('Hide selection bar')
    expect(hideButton).toBeInTheDocument()

    // selecting all items
    fireEvent.click(screen.getByText('Item file-foobar1'))
    fireEvent.click(screen.getByText('Item file-foobar2'))
    expect(screen.getByText('Item file-foobar1 selected')).toBeInTheDocument()
    expect(screen.getByText('Item file-foobar2 selected')).toBeInTheDocument()
    expect(screen.getByText('Hide selection bar')).toBeInTheDocument()

    // change route
    fireEvent.click(screen.getByText('Change route'))

    // hide selection bar and selecting all items
    await waitFor(async () => {
      expect(await screen.findByText('Item file-foobar1')).toBeInTheDocument()
      expect(await screen.findByText('Item file-foobar2')).toBeInTheDocument()
      expect(screen.queryByText('Hide selection bar')).toBeNull()
    })
  })
})
