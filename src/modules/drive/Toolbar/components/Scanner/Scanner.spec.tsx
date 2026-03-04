import { render, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'

import { createMockClient } from 'cozy-client'
import { useWebviewIntent } from 'cozy-intent'

// @ts-expect-error Component is not typed
import AppLike from 'test/components/AppLike'

import { ScannerMenuItem } from '@/modules/drive/Toolbar/components/Scanner/ScannerMenuItem'
import { ScannerProvider } from '@/modules/drive/Toolbar/components/Scanner/ScannerProvider'
import { uploadFiles } from '@/modules/navigation/duck'

const MockApp = ({ id = 'test', onClick = jest.fn() }): JSX.Element => (
  <AppLike client={createMockClient()}>
    <ScannerProvider displayedFolder={{ id }}>
      <ScannerMenuItem onClick={onClick} />
    </ScannerProvider>
  </AppLike>
)

jest.mock('cozy-device-helper', () => ({
  ...jest.requireActual('cozy-device-helper'),
  isFlagshipApp: (): boolean => true
}))

const mockUseWebviewIntent = useWebviewIntent as jest.Mock
jest.mock('cozy-intent', () => ({
  useWebviewIntent: jest.fn()
}))

const mockUploadFiles = uploadFiles as jest.Mock
jest.mock('modules/navigation/duck', () => ({
  uploadFiles: jest
    .fn()
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    .mockImplementation(arg => ({ type: 'test', payload: arg }))
}))

jest.spyOn(console, 'log').mockImplementation(() => jest.fn())

// Test suite for the Scanner functionality
describe('Scanner', () => {
  // Before each test, clear all mocks to ensure a clean state
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // Test case: Ensure that nothing is rendered if the scanner is not available
  it('renders nothing if the scanner is not available', () => {
    // Mock the useWebviewIntent hook to always return false for scanner availability
    mockUseWebviewIntent.mockReturnValue({
      call: jest.fn().mockResolvedValue(false)
    })

    // Render the component under test
    const { queryByTestId } = render(<MockApp />)

    // Assert that the scan-doc element is not present in the DOM
    expect(queryByTestId('scan-doc')).toBeNull()
  })

  // Test case: Check if an ActionMenuItem is rendered when the scanner is available
  it('renders an ActionMenuItem if the folder is available', async () => {
    // Mock the useWebviewIntent hook to simulate scanner availability
    mockUseWebviewIntent.mockReturnValue({
      call: jest.fn((method, arg) => {
        if (method === 'isAvailable' && arg === 'scanner') {
          return Promise.resolve(true)
        }
        return Promise.resolve(false)
      })
    })

    // Render the component under test
    const { queryByTestId } = render(<MockApp />)

    // Wait for the scanner to become available and assert that the scan-doc element is present
    await waitFor(() => {
      expect(queryByTestId('scan-doc')).not.toBeNull()
    })
  })

  // Test case: Simulate a click event and verify the startScanner function is called
  it('calls the startScanner function on click', async () => {
    // Mock the useWebviewIntent hook with custom logic for scanner availability and document scanning
    mockUseWebviewIntent.mockReturnValue({
      call: jest.fn((method, arg) => {
        if (method === 'isAvailable' && arg === 'scanner') {
          return Promise.resolve(true)
        }
        if (method === 'scanDocument') {
          return Promise.resolve('base64jpeg')
        }
        return Promise.resolve(false)
      })
    })
    const onClickMock = jest.fn()

    // Render the component under test
    const { queryByTestId } = render(<MockApp onClick={onClickMock} />)

    // Wait for the scan-doc element to be clickable and then simulate a click event
    await waitFor(() => {
      queryByTestId('scan-doc') as HTMLButtonElement
      fireEvent.click(
        queryByTestId('scan-doc')?.firstChild as HTMLButtonElement
      )
    })

    // Create a mock File object
    const mockFile = new File([], 'testfile')

    // Assert that mockUploadFiles was called once with the expected arguments
    expect(mockUploadFiles).toHaveBeenCalledTimes(1)

    const calls = mockUploadFiles.mock.calls as unknown[][]

    expect(onClickMock).toHaveBeenCalledTimes(1)
    expect(calls[0][0]).toEqual([mockFile]) // File
    expect(calls[0][1]).toBe('test') // Directory ID
    expect(calls[0][2]).toEqual({ isScanned: true }) // Upload options
    expect(typeof calls[0][3]).toBe('function') // Success callback
    // Dependencies
    expect(calls[0][4]).toMatchObject({
      client: expect.anything() as Record<string, unknown>,
      vaultClient: {},
      t: expect.anything() as (key: string) => string
    })
  })

  // Test case: Handle unexpected errors gracefully
  it('handles unexpected errors', async () => {
    const mockConsoleError = jest
      .spyOn(console, 'log')
      .mockImplementation(() => {
        // noop
      })

    // Mock the useWebviewIntent hook to throw an error
    mockUseWebviewIntent.mockReturnValue({
      call: jest.fn((method, arg) => {
        if (method === 'isAvailable' && arg === 'scanner') {
          return Promise.resolve(true)
        }

        if (method === 'scanDocument') {
          return Promise.reject(new Error('test error'))
        }

        return Promise.resolve(false)
      })
    })

    // Render the component under test
    const { queryByTestId } = render(<MockApp />)

    // Wait for the scan-doc element to be clickable and then simulate a click event
    await waitFor(() => {
      queryByTestId('scan-doc') as HTMLButtonElement
      fireEvent.click(
        queryByTestId('scan-doc')?.firstChild as HTMLButtonElement
      )
    })

    // Wait for the component to react to the error and assert that the scan-doc element is not present
    await waitFor(() => {
      expect(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        mockConsoleError.mock.calls.some(call => call[0].includes('test error'))
      ).toBe(true)
      expect(queryByTestId('scan-doc')).not.toBeNull()
    })
  })
})
