# Testing Patterns

**Analysis Date:** 2026-02-26

## Test Framework

**Runner:**
- Jest 29.7.0
- Config: `jest.config.js` at project root
- Transformer: SWC (@swc/jest) for JS/JSX/TS/TSX files
- Test environment: jsdom

**Assertion Library:**
- @testing-library/jest-dom 5.17.0 (DOM assertions)
- Jest built-in matchers (expect API)

**Testing Libraries:**
- @testing-library/react 14.3.1 - Component testing
- @testing-library/react-hooks 8.0.1 - Hook testing
- react-test-renderer 18.2.0 - Snapshot testing (if needed)

**Run Commands:**
```bash
yarn test                    # Run all tests with NODE_ENV=test
yarn test --watch          # Watch mode (if configured)
yarn test --coverage       # Coverage report
```

## Test File Organization

**Location:**
- Co-located with source files (same directory)
- Tests in `src/` directory structure, not separate `test/` directory
- Example: `src/lib/path.js` → `src/lib/path.spec.js`

**Naming:**
- `.spec.js` for JavaScript unit tests
- `.spec.jsx` for React component tests (JSX/TSX files)
- `.spec.ts` for TypeScript utility tests
- `.spec.tsx` for TypeScript React component tests
- Match source filename exactly, add `.spec` suffix before extension

**Structure:**
```
src/
├── lib/
│   ├── entries.js
│   ├── entries.spec.js
│   ├── path.js
│   └── path.spec.js
├── components/
│   ├── FolderPicker/
│   │   ├── FolderPicker.tsx
│   │   ├── FolderPicker.spec.jsx
│   │   ├── FolderPickerBody.tsx
│   │   └── FolderPickerBody.spec.jsx
└── hooks/
    ├── useDebounce.jsx
    ├── useKeyboardShortcuts.tsx
    └── useKeyboardShortcuts.spec.jsx
```

## Test Structure

**Suite Organization:**
```javascript
describe('ComponentOrFunction', () => {
  // Setup before all tests
  beforeEach(() => {
    // Common setup for each test
  })

  // Cleanup after all tests
  afterEach(() => {
    jest.resetAllMocks()
  })

  it('should do something specific', () => {
    // Arrange
    // Act
    // Assert
  })

  describe('SubFeature', () => {
    // Nested describe for related tests
    it('should handle edge case', () => {})
  })
})
```

**Patterns:**

1. **Arrange-Act-Assert Pattern:**
```javascript
it('should return file for entries only file', () => {
  // Arrange
  const input = [
    { type: 'file' },
    { type: 'file' }
  ]

  // Act
  const result = getEntriesType(input)

  // Assert
  expect(result).toBe('file')
})
```

2. **Given-When-Then Pattern (in async/complex tests):**
```javascript
it('should aggregateFilesSize with max file date query', async () => {
  // Given
  const client = 'client'
  CozyClient.fromEnv.mockReturnValue(client)
  aggregateFilesSize.mockResolvedValueOnce([])

  // When
  await run()

  // Then
  expect(aggregateFilesSize).toHaveBeenCalledWith(client, maxDate, {
    excludedSlug: 'excludedSlug'
  })
})
```

3. **Setup Function Pattern (for complex test data):**
```javascript
describe('FolderPicker', () => {
  const onCloseSpy = jest.fn()
  const onConfirmSpy = jest.fn()

  const setup = () => {
    const mockClient = createMockClient({
      queries: { /* ... */ }
    })
    return render(
      <AppLike client={mockClient}>
        <FolderPicker
          currentFolder={cozyFolder}
          entries={[cozyFile]}
          onClose={onCloseSpy}
          onConfirm={onConfirmSpy}
        />
      </AppLike>
    )
  }

  it('should display items', () => {
    setup()
    expect(screen.getByText('Photos')).toBeInTheDocument()
  })
})
```

## Mocking

**Framework:** jest.mock() and jest.fn()

**Mock Module Pattern:**
```javascript
jest.mock('cozy-client', () => ({
  ...jest.requireActual('cozy-client'),
  useInstanceInfo: jest.fn(() => ({
    isLoaded: true
  }))
}))

jest.mock('cozy-flags')
```

**Mock Return Values:**
```javascript
jest.mock('cozy-logger')

beforeEach(() => {
  flag.mockReturnValue({
    excludedSlug: 'excludedSlug',
    measureName: 'measureName'
  })
})

afterEach(() => {
  jest.resetAllMocks()
})
```

**Spy Functions:**
```javascript
const mockDispatch = jest.fn()
const mockShowAlert = jest.fn()
const mockCopyFiles = jest.fn()

// Reset between tests
mockCopyFiles.mockClear()

// Verify calls
expect(mockCopyFiles).toHaveBeenCalledWith(expectedArgs)
expect(mockCopyFiles).toHaveBeenCalledTimes(1)
expect(mockCopyFiles).toHaveBeenNthCalledWith(2, 'info', message)
```

**Mocking React Hooks:**
```javascript
jest.mock('./useCustomHook', () => ({
  useCustomHook: jest.fn()
}))

// In test
const { useCustomHook } = require('./useCustomHook')
useCustomHook.mockReturnValue({ data: [] })
```

**Mocking Child Components:**
```javascript
jest.mock('components/FolderPicker/FolderPickerBody', () => ({
  FolderPickerBody: jest
    .fn()
    .mockImplementation(({ isFolderCreationDisplayed }) => (
      <div data-testid="folder-picker-body">
        Mocked Body
      </div>
    ))
}))
```

**What to Mock:**
- External APIs and service calls
- Third-party library functions
- Child components in isolation tests
- Global objects (window, document methods with `.scroll = function() {}`)
- Module-level functionality (flags, config, logger)

**What NOT to Mock:**
- Core utilities being tested
- Standard library functions (Array methods, Object methods)
- React library functions (useState, useEffect, useContext)
- Testing library utilities (render, screen, fireEvent)

## Fixtures and Factories

**Test Data:**
```javascript
// Simple mock objects
const cozyFile = {
  id: 'file123',
  _id: 'file123',
  _type: 'io.cozy.files',
  dir_id: 'folder123',
  name: 'penguins.jpg'
}

const cozyFolder = {
  id: 'folder123',
  _id: 'folder123',
  _type: 'io.cozy.files',
  dir_id: 'io.cozy.files.root-dir',
  name: 'Photos'
}

// Mock client factory
const mockClient = createMockClient({
  queries: {
    'io.cozy.files/io.cozy.files.root-dir': {
      doctype: 'io.cozy.files',
      data: [rootCozyFolder]
    }
  }
})

// Complex mock data arrays
const mockedFilesQueryResponse = [
  {
    doc: {
      type: 'file',
      size: 1048576,
      cozyMetadata: {
        createdByApp: 'drive',
        uploadedAt: '2021-01-01'
      }
    }
  },
  // ... more items
]
```

**Location:**
- Test data defined at top of spec file
- Module-level constants for reusable fixtures
- Factory functions for complex object creation
- No separate fixtures directory (inline in tests)

## Coverage

**Requirements:** Not enforced (no minimum coverage percentage configured)

**View Coverage:**
```bash
yarn test --coverage
```

**Reporting:**
- Default Jest reporter
- Custom ConsoleUsageReporter at `jestHelpers/ConsoleUsageReporter.js` enforces no console output during tests
- Tests fail if console is used without explicit expectation

## Test Types

**Unit Tests:**
- Scope: Single function or hook
- Approach: Test function behavior with various inputs
- Example: `src/lib/path.spec.js` tests `getParentPath()` utility
- Mocking: Mock dependencies, test isolated behavior

```javascript
it('getParentPath', () => {
  expect(getParentPath('/')).toBeUndefined()
  expect(getParentPath('/folder1')).toEqual('/')
  expect(getParentPath('/folder1/folder2/folder3')).toEqual('/folder1/folder2')
})
```

**Component Tests:**
- Scope: React component rendering and interaction
- Approach: Render component with props, verify output and behavior
- Example: `src/components/FolderPicker/FolderPickerBody.spec.jsx`
- Mocking: Mock child components, mock external hooks and APIs

```javascript
it('return cozy folder', () => {
  const cozyFolder = { _type: 'io.cozy.files' }
  render(<FolderPickerBody folder={cozyFolder} {...defaultProps} />)
  expect(screen.getByText('FolderPickerContentCozy')).toBeInTheDocument()
})
```

**Hook Tests:**
- Scope: Custom React hook behavior
- Approach: Use `renderHook` with wrapper, test state updates
- Example: `src/hooks/useKeyboardShortcuts.spec.jsx`
- Pattern: Wrap hook in redux Provider if needed, use `act()` for state changes

```javascript
const wrapper = ({ children }) => <Provider store={store}>{children}</Provider>

renderHook(() => useKeyboardShortcuts({ client: mockClient }), { wrapper })

act(() => {
  document.dispatchEvent(event)
})

expect(mockCopyFiles).toHaveBeenCalledWith(...)
```

**Integration Tests:**
- Scope: Multiple components/modules working together
- Approach: Render parent component with real child components
- Example: `src/components/FolderPicker/FolderPicker.spec.jsx` tests full component tree
- Mocking: Only mock APIs and external services, not child components

## Common Patterns

**Async Testing:**
```javascript
it('should paste files when Ctrl+V is pressed', async () => {
  // Setup
  const wrapper = createWrapper()
  renderHook(() => useKeyboardShortcuts({ onPaste: mockOnPaste }), { wrapper })

  // Act
  await act(async () => {
    document.dispatchEvent(event)
  })

  // Assert
  expect(handlePasteOperation).toHaveBeenCalled()
})
```

**Error Testing:**
```javascript
it('should handle errors gracefully', async () => {
  // Setup - mock function to throw error
  mockApiCall.mockRejectedValueOnce(new Error('Network error'))

  // Act & Assert
  expect(async () => {
    await functionThatCalls(mockApiCall)
  }).rejects.toThrow('Network error')
})
```

**User Interaction Testing:**
```javascript
it('should call handler when button clicked', () => {
  render(<MyComponent onClick={mockHandler} />)

  const button = screen.getByRole('button', { name: /click me/i })
  fireEvent.click(button)

  expect(mockHandler).toHaveBeenCalled()
})
```

**Mocking Resolved Promises:**
```javascript
aggregateFilesSize.mockResolvedValueOnce([])
// Test handles resolved value

aggregateFilesSize.mockRejectedValueOnce(new Error('Failed'))
// Test handles rejected promise
```

**Checking Mock Call Arguments with Matchers:**
```javascript
expect(mockFunction).toHaveBeenCalledWith(
  mockClient,
  expect.any(Array),
  'copy',
  undefined,
  expect.objectContaining({
    _id: 'folder-id',
    driveId: 'drive-456'
  }),
  expect.any(Object)
)
```

## Jest Setup and Configuration

**Setup Files:**
- `jestHelpers/setup.js` - Global mocks for cozy-bar, cozy-intent, cozy-dataproxy-lib, cozy-flags, window.HTMLElement.prototype.scroll
- `jestHelpers/setupFilesAfterEnv.js` - Imports testing-library jest-dom, activates ConsoleUsageReporter

**Module Name Mapping:**
- Path aliases available for imports (e.g., `@/`, `models/`, `components/`, etc.)
- Mock modules for CSS/Stylus files (identity-obj-proxy)
- Mock modules for images and SVGs (custom mock files)
- Special handling for react-pdf worker

**Test Environment:**
- jsdom with custom URL: `http://cozy.localhost:8080/`
- Global `fixture` variable set to false

**Console Enforcement:**
- ConsoleUsageReporter makes tests fail if console is used without expectation
- Error reporting via Sentry integration captures console.error() calls
- Prevents accidental console.log() in production code

---

*Testing analysis: 2026-02-26*
