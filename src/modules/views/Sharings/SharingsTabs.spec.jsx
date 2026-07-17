import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'
import { useI18n } from 'twake-i18n'

import SharingsTabs from './SharingsTabs'

import {
  SHARING_TAB_BY_ME,
  SHARING_TAB_DRIVES,
  SHARING_TAB_WITH_ME
} from '@/constants/config'

jest.mock('twake-i18n')
jest.mock('cozy-ui/transpiled/react/providers/Breakpoints', () => ({
  __esModule: true,
  default: jest.fn()
}))

const mockUseBreakpoints = useBreakpoints

const renderTabs = (props = {}) =>
  render(
    <SharingsTabs
      tab={SHARING_TAB_WITH_ME}
      onChange={jest.fn()}
      showDrives
      {...props}
    />
  )

describe('SharingsTabs', () => {
  beforeEach(() => {
    useI18n.mockReturnValue({ t: key => key })
  })

  // The two breakpoints share the whole behavior; only the variant of the
  // underlying Tabs differs (asserted separately below).
  describe.each([
    ['desktop', false],
    ['mobile', true]
  ])('on %s', (_, isMobile) => {
    beforeEach(() => {
      mockUseBreakpoints.mockReturnValue({ isMobile })
    })

    it('renders the three tabs when drives are shown', () => {
      renderTabs()

      expect(screen.getAllByRole('tab')).toHaveLength(3)
      expect(
        screen.getByRole('tab', { name: 'toolbar.sharings_tab_with_me' })
      ).toBeInTheDocument()
      expect(
        screen.getByRole('tab', { name: 'toolbar.sharings_tab_by_me' })
      ).toBeInTheDocument()
      expect(
        screen.getByRole('tab', { name: 'toolbar.sharings_tab_drives' })
      ).toBeInTheDocument()
    })

    it('hides the drives tab when showDrives is false', () => {
      renderTabs({ showDrives: false })

      expect(screen.getAllByRole('tab')).toHaveLength(2)
      expect(
        screen.queryByRole('tab', { name: 'toolbar.sharings_tab_drives' })
      ).not.toBeInTheDocument()
    })

    it('marks the active tab as selected', () => {
      renderTabs({ tab: SHARING_TAB_BY_ME })

      expect(
        screen.getByRole('tab', { name: 'toolbar.sharings_tab_by_me' })
      ).toHaveAttribute('aria-selected', 'true')
      expect(
        screen.getByRole('tab', { name: 'toolbar.sharings_tab_with_me' })
      ).toHaveAttribute('aria-selected', 'false')
    })

    it('calls onChange with the tab slug when activating another tab', () => {
      const onChange = jest.fn()
      renderTabs({ onChange })

      fireEvent.click(
        screen.getByRole('tab', { name: 'toolbar.sharings_tab_drives' })
      )

      expect(onChange).toHaveBeenCalledWith(SHARING_TAB_DRIVES)
    })

    it('does not call onChange when re-activating the active tab', () => {
      const onChange = jest.fn()
      renderTabs({ onChange })

      fireEvent.click(
        screen.getByRole('tab', { name: 'toolbar.sharings_tab_with_me' })
      )

      expect(onChange).not.toHaveBeenCalled()
    })
  })

  it('renders the segmented pill variant on desktop only', () => {
    mockUseBreakpoints.mockReturnValue({ isMobile: false })
    const { container: desktop } = renderTabs()
    // The theme's segmented variant is the Figma pill track.
    expect(desktop.querySelector('.MuiTabs-root.segmented')).toBeTruthy()

    mockUseBreakpoints.mockReturnValue({ isMobile: true })
    const { container: mobile } = renderTabs()
    // Interim mobile design keeps the plain full-width tabs.
    expect(mobile.querySelector('.MuiTabs-root.segmented')).toBeNull()
  })
})
