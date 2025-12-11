import { render, fireEvent, screen } from '@testing-library/react'
import React from 'react'

import { createMockClient, useQuery } from 'cozy-client'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'

import AppLike from 'test/components/AppLike'
import { officeDoc } from 'test/data'

import * as hookHelpers from '@/hooks/helpers'
import { OnlyOfficeContext } from '@/modules/views/OnlyOffice/OnlyOfficeProvider'
import Toolbar from '@/modules/views/OnlyOffice/Toolbar'

jest.mock('cozy-sharing', () => ({
  ...jest.requireActual('cozy-sharing'),
  __esModule: true,
  OpenSharingLinkButton: () => <div data-testid="open-external-link-button" />
}))

jest.mock(
  '@/modules/views/OnlyOffice/Toolbar/HomeLinker',
  () =>
    ({ children }) =>
      <div data-testid="HomeLinker">{children}</div>
)

jest.mock('cozy-ui/transpiled/react/providers/Breakpoints', () => ({
  ...jest.requireActual('cozy-ui/transpiled/react/providers/Breakpoints'),
  __esModule: true,
  default: jest.fn(),
  useBreakpoints: jest.fn()
}))
jest.mock('cozy-client/dist/hooks/useQuery', () => jest.fn())
jest.mock('modules/views/OnlyOffice/Toolbar/helpers', () => ({
  ...jest.requireActual('modules/views/OnlyOffice/Toolbar/helpers'),
  computeHomeApp: jest.fn(() => ({ slug: 'slug' }))
}))

const mockNavigate = jest.fn()
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate
}))

jest.mock('cozy-client/dist/models/file', () => ({
  ...jest.requireActual('cozy-client/dist/models/file'),
  ensureFilePath: jest.fn(doc => ({ ...doc, path: '/' }))
}))

jest.mock(
  '@/modules/views/OnlyOffice/Toolbar/SummarizeByAIButtonWrapper',
  () => ({
    __esModule: true,
    default: () => null
  })
)

const client = createMockClient({})
client.stackClient.uri = 'http://cozy.tools'
client.plugins = {
  realtime: {
    subscribe: () => {},
    unsubscribe: () => {}
  }
}
client.collection = () => ({
  fetchOwnPermissions: () =>
    Promise.resolve({
      included: []
    })
})
const defaultSharingInfos = {
  addSharingLink: '',
  isSharingShortcutCreated: false,
  loading: false,
  createCozyLink: 'http://cozy.tools'
}
const setup = ({
  isReadOnly = false,
  isPublic = false,
  isFromSharing = false,
  isMobile = false,
  isEditorModeView = false,
  sharingInfos = {}
} = {}) => {
  const sharingInfosProps = {
    ...defaultSharingInfos,
    ...sharingInfos
  }
  useBreakpoints.mockReturnValue({ isMobile })

  const root = render(
    <AppLike
      client={client}
      sharingContextValue={{
        byDocId: { 123: {} },
        documentType: 'Files'
      }}
    >
      <OnlyOfficeContext.Provider
        value={{
          fileId: officeDoc.id,
          isPublic,
          isEditorModeView,
          isFromSharing,
          isReadOnly,
          isEditorReady: true
        }}
      >
        <Toolbar sharingInfos={sharingInfosProps} />
      </OnlyOfficeContext.Provider>
    </AppLike>
  )

  return { root }
}

describe('Toolbar', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation()
    jest.clearAllMocks()
  })

  describe('FileName', () => {
    it('should show the path', () => {
      // TODO : analyse why BaseButton has incorrect props and remove this consoleSpy
      jest.spyOn(console, 'error').mockImplementation()

      useQuery.mockReturnValue({ data: [officeDoc] })

      const { root } = setup({ isMobile: false })
      const { queryByTestId } = root

      expect(queryByTestId('onlyoffice-filename-path')).toBeTruthy()
    })

    it('should not show the path on mobile', () => {
      useQuery.mockReturnValue({ data: [officeDoc] })

      const { root } = setup({ isMobile: true })
      const { queryByTestId } = root

      expect(queryByTestId('onlyoffice-filename-path')).toBeFalsy()
    })
  })

  describe('Renaming', () => {
    it('should be able to rename the file if not in readOnly mode', () => {
      useQuery.mockReturnValue({ data: [officeDoc] })

      const { root } = setup({ isReadOnly: false })
      const { getByText, getByRole } = root

      fireEvent.click(getByText(officeDoc.name))
      expect(getByRole('textbox').value).toBe(officeDoc.name)
    })

    it('should not be able to rename the file in readOnly mode', () => {
      useQuery.mockReturnValue({ data: [officeDoc] })

      const { root } = setup({ isReadOnly: true })
      const { getByText, queryByRole } = root

      fireEvent.click(getByText(officeDoc.name))
      expect(queryByRole('textbox')).toBeFalsy()
    })

    describe('Renaming on mobile', () => {
      it('should be able to rename the file if not in readOnly mode', () => {
        useQuery.mockReturnValue({ data: [officeDoc] })

        const { root } = setup({ isReadOnly: false, isMobile: true })
        const { getByText, getByRole } = root

        fireEvent.click(getByText(officeDoc.name))
        expect(getByRole('textbox').value).toBe(officeDoc.name)
      })
    })
  })

  describe('Sharing', () => {
    describe('Private view', () => {
      it('should show sharing button', () => {
        useQuery.mockReturnValue({ data: [officeDoc] })

        const { root } = setup({ isPublic: false })
        const { queryByTestId } = root

        expect(queryByTestId('onlyoffice-sharing-button')).toBeTruthy()
      })
      it('should not show more menu', () => {
        useQuery.mockReturnValue({ data: [officeDoc] })

        const { root } = setup({ isPublic: false })
        const { queryByTestId } = root

        expect(queryByTestId('more-menu')).toBeNull()
      })

      describe('On mobile', () => {
        it('should show sharing icon', () => {
          useQuery.mockReturnValue({ data: [officeDoc] })

          const { root } = setup({ isPublic: false, isMobile: true })
          const { queryByTestId } = root

          expect(queryByTestId('onlyoffice-sharing-button')).toBeFalsy()
          expect(queryByTestId('onlyoffice-sharing-icon')).toBeTruthy()
        })
        it('should not show more menu', () => {
          useQuery.mockReturnValue({ data: [officeDoc] })

          const { root } = setup({ isPublic: false, isMobile: true })
          const { queryByTestId } = root

          expect(queryByTestId('more-menu')).toBeNull()
        })
      })
    })

    describe('Public view', () => {
      describe('Cozy to Cozy', () => {
        it('should not show sharing button', () => {
          useQuery.mockReturnValue({ data: [officeDoc] })

          const sharingInfos = {
            isSharingShortcutCreated: false
          }
          const { root } = setup({ isPublic: true, sharingInfos })
          const { queryByTestId } = root

          expect(queryByTestId('onlyoffice-sharing-button')).toBeNull()
        })
        describe("Sharing is not added to the recipient's Cozy", () => {
          it('should show "MoreMenu" button', () => {
            useQuery.mockReturnValue({ data: [officeDoc] })

            const sharingInfos = {
              isSharingShortcutCreated: false
            }
            const { root } = setup({ isPublic: true, sharingInfos })
            const { queryByTestId } = root

            expect(queryByTestId('more-menu')).toBeTruthy()
          })
          it('should show "Add to my Cozy" button', () => {
            useQuery.mockReturnValue({ data: [officeDoc] })

            const sharingInfos = {
              isSharingShortcutCreated: false
            }
            const { root } = setup({ isPublic: true, sharingInfos })
            const { queryByTestId } = root

            expect(queryByTestId('open-external-link-button')).toBeTruthy()
          })

          describe('On mobile', () => {
            it('should not show sharing icon and button', () => {
              useQuery.mockReturnValue({ data: [officeDoc] })

              const sharingInfos = {
                isSharingShortcutCreated: false
              }
              const { root } = setup({
                isPublic: true,
                isMobile: true,
                sharingInfos
              })
              const { queryByTestId } = root

              expect(queryByTestId('onlyoffice-sharing-button')).toBeNull()
              expect(queryByTestId('onlyoffice-sharing-icon')).toBeNull()
            })
            it('should show more menu', () => {
              useQuery.mockReturnValue({ data: [officeDoc] })

              const sharingInfos = {
                isSharingShortcutCreated: false
              }
              const { root } = setup({
                isPublic: true,
                isMobile: true,
                sharingInfos
              })
              const { queryByTestId } = root

              expect(queryByTestId('more-menu')).toBeTruthy()
            })
          })
        })

        describe("Sharing is added to the recipient's Cozy (not sync)", () => {
          it('should not show sharing button', () => {
            useQuery.mockReturnValue({ data: [officeDoc] })

            const sharingInfos = {
              isSharingShortcutCreated: true
            }
            const { root } = setup({ isPublic: true, sharingInfos })
            const { queryByTestId } = root

            expect(queryByTestId('onlyoffice-sharing-button')).toBeNull()
          })
          it('should show "MoreMenu" button', () => {
            useQuery.mockReturnValue({ data: [officeDoc] })

            const sharingInfos = {
              isSharingShortcutCreated: true
            }
            const { root } = setup({ isPublic: true, sharingInfos })
            const { queryByTestId } = root

            expect(queryByTestId('more-menu')).toBeTruthy()
          })
          it('should not show "Add to my Cozy" button', () => {
            useQuery.mockReturnValue({ data: [officeDoc] })

            const sharingInfos = {
              isSharingShortcutCreated: true
            }
            const { root } = setup({ isPublic: true, sharingInfos })
            const { queryByTestId } = root

            expect(queryByTestId('open-external-link-button')).toBeNull()
          })

          describe('On mobile', () => {
            it('should not show sharing icon and button', () => {
              useQuery.mockReturnValue({ data: [officeDoc] })

              const sharingInfos = {
                isSharingShortcutCreated: true
              }
              const { root } = setup({
                isPublic: true,
                isMobile: true,
                sharingInfos
              })
              const { queryByTestId } = root

              expect(queryByTestId('onlyoffice-sharing-button')).toBeNull()
              expect(queryByTestId('onlyoffice-sharing-icon')).toBeNull()
            })
            it('should show more menu', () => {
              useQuery.mockReturnValue({ data: [officeDoc] })

              const sharingInfos = {
                isSharingShortcutCreated: true
              }
              const { root } = setup({
                isPublic: true,
                isMobile: true,
                sharingInfos
              })
              const { queryByTestId } = root

              expect(queryByTestId('more-menu')).toBeTruthy()
            })
          })
        })
      })
    })
  })

  const savedLocation = window.location
  const makeNewLocation = (path = '') => {
    window.location = new URL(`http://cozy-test.tools/${path}`)
  }

  describe('Back Button', () => {
    beforeEach(() => {
      delete window.location
    })

    afterEach(() => {
      window.location = savedLocation
    })

    it('should hide without redirect link into searchParam', () => {
      makeNewLocation('#/onlyoffice/123')
      useQuery.mockReturnValue({ data: [officeDoc] })

      setup()

      const backButton = screen.queryByRole('button', {
        name: 'Back'
      })
      expect(backButton).toBeNull()
    })

    it('should redirect to previous folder with #/hash?searchParam ', async () => {
      makeNewLocation('#/onlyoffice/123?redirectLink=drive%23%2Ffolder%2F321')
      useQuery.mockReturnValue({ data: [officeDoc] })

      setup()

      const button = await screen.findByRole('button', {
        name: 'Back'
      })

      fireEvent.click(button)

      expect(mockNavigate).toHaveBeenCalledWith('/folder/321')
    })

    it('should redirect to previous folder from current cozy user', async () => {
      const spyOnChangeLocation = jest.spyOn(hookHelpers, 'changeLocation')
      client.collection = () => ({
        fetchOwnPermissions: () =>
          Promise.resolve({
            included: [
              {
                attributes: {
                  instance: 'http://other.tools/'
                }
              }
            ]
          })
      })
      makeNewLocation('?redirectLink=drive%23%2Ffolder%2F321#/onlyoffice/123')
      useQuery.mockReturnValue({ data: [officeDoc] })

      setup({
        isPublic: true
      })

      const button = await screen.findByRole('button', {
        name: 'Back'
      })

      fireEvent.click(button)

      expect(spyOnChangeLocation).toHaveBeenCalledWith(
        'http://other-drive.tools/#/folder/321'
      )
    })
  })
})
