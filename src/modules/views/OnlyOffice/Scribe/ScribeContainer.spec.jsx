import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'

jest.mock('cozy-ui/transpiled/react/providers/Breakpoints', () => {
  const mock = jest.fn()
  return {
    ...jest.requireActual('cozy-ui/transpiled/react/providers/Breakpoints'),
    __esModule: true,
    default: mock,
    useBreakpoints: mock
  }
})

jest.mock('cozy-ui/transpiled/react/Popover', () => {
  const MockPopover = ({ children, ...props }) => (
    <div data-testid="popover" data-props={JSON.stringify(props)}>
      {children}
    </div>
  )
  MockPopover.displayName = 'MockPopover'
  return { __esModule: true, default: MockPopover }
})

jest.mock('cozy-ui/transpiled/react/Drawer', () => {
  const MockDrawer = ({ children, ...props }) => {
    // Serialize ModalProps and PaperProps for assertion
    const serializable = {
      anchor: props.anchor,
      open: props.open,
      ModalProps: props.ModalProps,
      PaperProps: props.PaperProps
    }
    return (
      <div
        data-testid="drawer"
        data-props={JSON.stringify(serializable)}
        onClick={() => props.onClose && props.onClose({}, 'backdropClick')}
      >
        {children}
      </div>
    )
  }
  MockDrawer.displayName = 'MockDrawer'
  return { __esModule: true, default: MockDrawer }
})

import { ScribeContainer } from '@/modules/views/OnlyOffice/Scribe/ScribeContainer'

describe('ScribeContainer', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders Popover (not Drawer) on desktop with passthrough props', () => {
    useBreakpoints.mockReturnValue({ isMobile: false })

    const popoverProps = {
      anchorReference: 'anchorPosition',
      anchorPosition: { top: 400, left: 500 },
      transformOrigin: { vertical: 'center', horizontal: 'center' }
    }

    render(
      <ScribeContainer open={true} onClose={jest.fn()} {...popoverProps}>
        <div data-testid="content">Hello</div>
      </ScribeContainer>
    )

    expect(screen.getByTestId('popover')).toBeInTheDocument()
    expect(screen.queryByTestId('drawer')).not.toBeInTheDocument()
    expect(screen.getByTestId('content')).toBeInTheDocument()

    const props = JSON.parse(screen.getByTestId('popover').dataset.props)
    expect(props.open).toBe(true)
    expect(props.anchorReference).toBe('anchorPosition')
    expect(props.anchorPosition).toEqual({ top: 400, left: 500 })
    expect(props.transformOrigin).toEqual({
      vertical: 'center',
      horizontal: 'center'
    })
  })

  it('renders Drawer (not Popover) on mobile', () => {
    useBreakpoints.mockReturnValue({ isMobile: true })

    render(
      <ScribeContainer open={true} onClose={jest.fn()}>
        <div data-testid="content">Hello</div>
      </ScribeContainer>
    )

    expect(screen.getByTestId('drawer')).toBeInTheDocument()
    expect(screen.queryByTestId('popover')).not.toBeInTheDocument()
    expect(screen.getByTestId('content')).toBeInTheDocument()

    const props = JSON.parse(screen.getByTestId('drawer').dataset.props)
    expect(props.anchor).toBe('bottom')
    expect(props.open).toBe(true)
  })

  it('configures Drawer with correct ModalProps on mobile', () => {
    useBreakpoints.mockReturnValue({ isMobile: true })

    render(
      <ScribeContainer open={true} onClose={jest.fn()}>
        <div>Content</div>
      </ScribeContainer>
    )

    const props = JSON.parse(screen.getByTestId('drawer').dataset.props)
    expect(props.ModalProps).toEqual({
      disableScrollLock: true,
      disableEnforceFocus: true,
      disableAutoFocus: true
    })
  })

  it('configures Drawer PaperProps for a bottom sheet on mobile', () => {
    useBreakpoints.mockReturnValue({ isMobile: true })

    render(
      <ScribeContainer open={true} onClose={jest.fn()}>
        <div>Content</div>
      </ScribeContainer>
    )

    const props = JSON.parse(screen.getByTestId('drawer').dataset.props)
    expect(props.PaperProps.style).toEqual(
      expect.objectContaining({
        maxHeight: '85vh',
        borderRadius: '12px 12px 0 0'
      })
    )
  })

  it('calls onClose when Drawer backdrop is clicked on mobile', () => {
    useBreakpoints.mockReturnValue({ isMobile: true })
    const handleClose = jest.fn()

    render(
      <ScribeContainer open={true} onClose={handleClose}>
        <div>Content</div>
      </ScribeContainer>
    )

    fireEvent.click(screen.getByTestId('drawer'))
    expect(handleClose).toHaveBeenCalledTimes(1)
  })
})
