import React, { forwardRef } from 'react'

import TableContainer from 'cozy-ui/transpiled/react/TableContainer'

import DnDConfigWrapper from './DnDConfigWrapper'

const TableScroller = forwardRef(({ context, ...props }, ref) => (
  <DnDConfigWrapper ref={ref}>
    <TableContainer {...props} ref={ref} />
  </DnDConfigWrapper>
))

TableScroller.displayName = 'TableScroller'

export default TableScroller
