import React, { forwardRef } from 'react'

// JSDOM has no layout; keep the real grid items and list, replacing only the viewport.
export const VirtualizedGridMock = forwardRef(function VirtualizedGridMock(
  { items, itemContent, components, context },
  ref
) {
  const List = components.List
  return (
    <List ref={ref} context={context}>
      {items.map((item, index) => (
        <div key={item._id}>{itemContent(index)}</div>
      ))}
    </List>
  )
})
