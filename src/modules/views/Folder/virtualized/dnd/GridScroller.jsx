import React, { forwardRef } from 'react'

import DnDConfigWrapper from './DnDConfigWrapper'

const GridScroller = forwardRef(({ context, ...props }, ref) => (
  <DnDConfigWrapper ref={ref}>
    <div {...props} ref={ref} />
  </DnDConfigWrapper>
))

GridScroller.displayName = 'GridScroller'

export default GridScroller
