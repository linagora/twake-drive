import { render, screen } from '@testing-library/react'
import React, { createRef } from 'react'

import Box from 'cozy-ui/transpiled/react/Box'

import GridWrapper from './GridWrapper'

const virtualizerStyle = { paddingTop: 384, paddingBottom: 192 }

describe('GridWrapper', () => {
  it('preserves the virtualizer padding, children and DOM ref', () => {
    const ref = createRef()
    const { container } = render(
      <GridWrapper ref={ref} style={virtualizerStyle}>
        <span>Photos</span>
      </GridWrapper>
    )

    expect(screen.queryByText('Photos')).toBeInTheDocument()
    expect(ref.current).toBe(container.firstElementChild)
    expect(ref.current).toHaveStyle({
      paddingTop: '384px',
      paddingBottom: '192px'
    })
  })

  it('supports cozy-ui layout styling without losing virtualizer padding', () => {
    const { container } = render(
      <Box
        component={GridWrapper}
        gridColumnGap={8}
        justifyContent="flex-start"
        style={virtualizerStyle}
      >
        <span>Photos</span>
      </Box>
    )

    expect(screen.queryByText('Photos')).toBeInTheDocument()
    expect(container.firstElementChild).toHaveStyle({
      justifyContent: 'flex-start',
      paddingTop: '384px'
    })
  })
})
