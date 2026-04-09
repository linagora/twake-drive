import { render, fireEvent, act } from '@testing-library/react'
import React from 'react'
import { useLocation } from 'react-router-dom'

import { NavLink } from './NavLink'

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useLocation: jest.fn()
}))

jest.mock('cozy-ui/transpiled/react/Nav', () => ({
  NavLink: { className: 'nav-link', activeClassName: 'active' }
}))

describe('NavLink', () => {
  beforeEach(() => {
    useLocation.mockReturnValue({ pathname: '/recent' })
  })

  describe('click handler', () => {
    it('calls setLastClicked with to on click', () => {
      const setLastClicked = jest.fn()
      const { getByRole } = render(
        <NavLink to="/folder" clickState={[null, setLastClicked]}>
          Drive
        </NavLink>
      )
      fireEvent.click(getByRole('link'))
      expect(setLastClicked).toHaveBeenCalledWith('/folder')
    })

    it('prevents default when no to prop', () => {
      const setLastClicked = jest.fn()
      const { getByRole } = render(
        <NavLink clickState={[null, setLastClicked]}>Drive</NavLink>
      )
      const event = new MouseEvent('click', { bubbles: true, cancelable: true })
      getByRole('link').dispatchEvent(event)
      expect(event.defaultPrevented).toBe(true)
    })
  })

  describe('optimistic active state', () => {
    it('shows as active when lastClicked matches rx', () => {
      const rx = /\/(folder|nextcloud)(\/.*)?/
      const { getByRole } = render(
        <NavLink to="/folder" rx={rx} clickState={['/folder', jest.fn()]}>
          Drive
        </NavLink>
      )
      expect(getByRole('link').className).toContain('active')
    })

    it('is not active when lastClicked does not match rx', () => {
      const rx = /\/(folder|nextcloud)(\/.*)?/
      const { getByRole } = render(
        <NavLink to="/folder" rx={rx} clickState={['/recent', jest.fn()]}>
          Drive
        </NavLink>
      )
      expect(getByRole('link').className).not.toContain('active')
    })
  })

  describe('useEffect: reset lastClicked when route arrives', () => {
    it('does not reset lastClicked while the route has not yet changed', () => {
      const setLastClicked = jest.fn()
      useLocation.mockReturnValue({ pathname: '/recent' })

      render(
        <NavLink
          to="/folder"
          rx={/\/(folder|nextcloud)(\/.*)?/}
          clickState={['/folder', setLastClicked]}
        >
          Drive
        </NavLink>
      )

      expect(setLastClicked).not.toHaveBeenCalledWith(null)
    })

    it('resets lastClicked once the route matches rx', async () => {
      const setLastClicked = jest.fn()
      useLocation.mockReturnValue({ pathname: '/recent' })
      const rx = /\/(folder|nextcloud)(\/.*)?/

      const { rerender } = render(
        <NavLink to="/folder" rx={rx} clickState={['/folder', setLastClicked]}>
          Drive
        </NavLink>
      )

      useLocation.mockReturnValue({ pathname: '/folder' })
      await act(async () => {
        rerender(
          <NavLink
            to="/folder"
            rx={rx}
            clickState={['/folder', setLastClicked]}
          >
            Drive
          </NavLink>
        )
      })

      expect(setLastClicked).toHaveBeenCalledWith(null)
    })

    it('resets lastClicked once the route matches without rx', async () => {
      const setLastClicked = jest.fn()
      useLocation.mockReturnValue({ pathname: '/recent' })

      const { rerender } = render(
        <NavLink to="folder" clickState={['folder', setLastClicked]}>
          Drive
        </NavLink>
      )

      useLocation.mockReturnValue({ pathname: '/folder' })
      await act(async () => {
        rerender(
          <NavLink to="folder" clickState={['folder', setLastClicked]}>
            Drive
          </NavLink>
        )
      })

      expect(setLastClicked).toHaveBeenCalledWith(null)
    })

    it('does not reset lastClicked when route changes to a different destination', async () => {
      const setLastClicked = jest.fn()
      useLocation.mockReturnValue({ pathname: '/recent' })
      const rx = /\/(folder|nextcloud)(\/.*)?/

      const { rerender } = render(
        <NavLink to="/folder" rx={rx} clickState={['/folder', setLastClicked]}>
          Drive
        </NavLink>
      )

      // Route changed but to /trash, not /folder
      useLocation.mockReturnValue({ pathname: '/trash' })
      await act(async () => {
        rerender(
          <NavLink
            to="/folder"
            rx={rx}
            clickState={['/folder', setLastClicked]}
          >
            Drive
          </NavLink>
        )
      })

      expect(setLastClicked).not.toHaveBeenCalledWith(null)
    })
  })
})
