import { render } from '@testing-library/react'
import React from 'react'
import I18n from 'twake-i18n'

import { createMockClient } from 'cozy-client'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'

import LightFileViewer from './LightFileViewer'
import AppLike from 'test/components/AppLike'

jest.mock('cozy-keys-lib', () => ({
  ...jest.requireActual('cozy-keys-lib'),
  useVaultClient: jest.fn()
}))
jest.mock('cozy-intent', () => ({
  WebviewIntentProvider: ({ children }) => children,
  useWebviewIntent: () => ({ call: () => {} })
}))
jest.mock('cozy-ui/transpiled/react/providers/Breakpoints', () => ({
  ...jest.requireActual('cozy-ui/transpiled/react/providers/Breakpoints'),
  __esModule: true,
  default: jest.fn()
}))
// used inside cozy-viewer
jest.mock('cozy-client/dist/models/permission', () => ({
  ...jest.requireActual('cozy-client/dist/models/permission'),
  isDocumentReadOnly: jest.fn().mockResolvedValue(false)
}))

const client = new createMockClient({})

const setup = ({ isDesktop = false, isMobile = false } = {}) => {
  useBreakpoints.mockReturnValue({ isDesktop, isMobile })
  const root = render(
    <AppLike client={client}>
      <I18n lang="en" dictRequire={() => ''}>
        <LightFileViewer
          files={[{ id: '01', type: 'file', name: 'fileName.txt' }]}
        />
      </I18n>
    </AppLike>
  )

  return { root }
}

describe('LightFileViewer', () => {
  describe('on Mobile and Tablet', () => {
    it('should have the sharing banner and public toolbar but no viewer toolbar', () => {
      jest.spyOn(console, 'error').mockImplementation() // TODO: to be removed with https://github.com/cozy/cozy-libs/pull/1457
      jest.spyOn(console, 'warn').mockImplementation()

      const { root } = setup({ isMobile: true })
      const { queryByTestId, queryAllByRole } = root

      expect(queryAllByRole('link')[0].getAttribute('href')).toBe(
        'https://twake.app'
      ) // This is the sharing banner
      expect(queryByTestId('public-toolbar')).toBeTruthy()
      expect(queryByTestId('viewer-toolbar')).toBeFalsy()
    })
  })

  describe('on Desktop', () => {
    it('should have the sharing banner and viewer toolbar but no public toolbar', () => {
      const { root } = setup({ isDesktop: true })
      const { queryByTestId, queryAllByRole } = root

      expect(queryAllByRole('link')[0].getAttribute('href')).toBe(
        'https://twake.app'
      ) // This is the sharing banner
      expect(queryByTestId('public-toolbar')).toBeFalsy()
      expect(queryByTestId('viewer-toolbar')).toBeTruthy()
    })
  })
})
