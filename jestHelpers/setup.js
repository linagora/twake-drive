import React from 'react'
import { TransformStream } from 'stream/web'

global.cozy = {}
global.TransformStream = TransformStream

jest.mock('cozy-search', () => ({}))

jest.mock('cozy-bar', () => ({
  ...jest.requireActual('cozy-bar'),
  BarComponent: () => <div>Bar</div>,
  BarLeft: ({ children }) => children,
  BarRight: ({ children }) => children,
  BarCenter: ({ children }) => children,
  BarSearch: ({ children }) => children
}))

jest.mock('cozy-intent', () => ({
  useWebviewIntent: jest.fn()
}))

jest.mock('cozy-dataproxy-lib', () => ({
  DataProxyProvider: ({ children }) => children
}))

// Mock cozy-flags with jest mock function that supports both flag checking and test mocking
jest.mock('cozy-flags', () => {
  const mockFn = jest.fn(flagName => {
    if (flagName === 'drive.highlight-new-items.enabled') {
      return true
    }
    // Return false for all other flags to avoid issues
    return false
  })

  // Add initialize method that some tests expect
  mockFn.initialize = jest.fn()

  return mockFn
})

// see https://github.com/jsdom/jsdom/issues/1695
window.HTMLElement.prototype.scroll = function () {}
