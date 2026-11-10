import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'

import SearchView from './SearchView'

const mockNavigate = jest.fn()
const mockUseLocation = jest.fn()

jest.mock('react-router-dom', () => ({
  useLocation: () => mockUseLocation(),
  useNavigate: () => mockNavigate
}))

jest.mock('cozy-bar', () => ({
  BarLeft: ({ children }) => <div>{children}</div>,
  BarSearch: () => null
}))

jest.mock('cozy-client', () => ({
  ...jest.requireActual('cozy-client'),
  useClient: jest.fn()
}))

jest.mock('cozy-intent', () => ({
  useWebviewIntent: jest.fn()
}))

jest.mock('cozy-ui/transpiled/react/Layout', () => ({
  Main: ({ children }) => <div>{children}</div>
}))

jest.mock('cozy-ui/transpiled/react/providers/Breakpoints', () => {
  const useBreakpoints = () => ({ isMobile: true })
  return { __esModule: true, default: useBreakpoints, useBreakpoints }
})

jest.mock('twake-i18n', () => ({
  translate: () => Component => Component,
  useI18n: () => ({ t: key => key })
}))

jest.mock('@/components/Button/BackButton', () => ({ onClick }) => (
  <button onClick={onClick}>Back</button>
))

jest.mock('@/modules/search/hooks/useSearch', () => () => ({
  isBusy: false,
  suggestions: [],
  hasSuggestions: false,
  query: '',
  makeIndexes: jest.fn(),
  hasMore: false,
  fetchMore: jest.fn()
}))

describe('SearchView', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it.each([
    ['%2Ffolder%2Fid123', '/folder/id123'],
    ['%2F%5Cevil.example', '/'],
    ['%2F..%2F%2Fevil.example', '/'],
    ['', '/']
  ])('navigates back from returnPath=%s to %s', (returnPath, expected) => {
    mockUseLocation.mockReturnValue({ search: `?returnPath=${returnPath}` })

    render(<SearchView />)
    fireEvent.click(screen.getByText('Back'))

    expect(mockNavigate).toHaveBeenCalledWith(expected)
  })
})
