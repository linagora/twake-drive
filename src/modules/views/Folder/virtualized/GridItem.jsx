import React from 'react'

import DraggableGridItem from './dnd/DraggableGridItem'

import styles from '@/styles/filelist.styl'

const GridItem = ({ context, 'data-index': index }) => (
  <DraggableGridItem
    item={context.items[index]}
    context={context}
    className={styles['fil-content-grid-item']}
  />
)

export default React.memo(GridItem)
