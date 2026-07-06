import React from 'react'
import { ReadableStream, TransformStream } from 'stream/web'
import { TextDecoder, TextEncoder } from 'util'

global.cozy = {}
global.TransformStream = TransformStream
// jsdom doesn't expose Web Streams/Fetch/encoding APIs needed by
// assistant-stream and undici
global.ReadableStream = ReadableStream
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder
// undici reads TextEncoder at load time, so it must come after the polyfills
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Response } = require('undici')
global.Response = Response

jest.mock('cozy-search', () => ({
  AiText: () => null,
  AssistantDesktop: () => null,
  AssistantDialog: () => null,
  AssistantView: () => null,
  SearchDialog: () => null
}))

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
  const mockFn = jest.fn(() => {
    // Return false for all other flags to avoid issues
    return false
  })

  // Add initialize method that some tests expect
  mockFn.initialize = jest.fn()

  return mockFn
})

// see https://github.com/jsdom/jsdom/issues/1695
window.HTMLElement.prototype.scroll = function () {}
