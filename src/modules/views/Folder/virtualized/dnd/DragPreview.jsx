import cx from 'classnames'
import React from 'react'

import Badge from 'cozy-ui/transpiled/react/Badge'
import Paper from 'cozy-ui/transpiled/react/Paper'
import Typography from 'cozy-ui/transpiled/react/Typography'

import styles from './CustomDragLayer.styl'

const DragPreview = ({ fileName, selectedCount }) => (
  <>
    {selectedCount > 1 ? (
      <Badge
        badgeContent={selectedCount}
        size="large"
        color="primary"
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'right'
        }}
        overlap="rectangular"
      >
        <Paper className={cx(styles.dragPreview, 'u-p-half u-maw-5')}>
          <Typography>{fileName}</Typography>
        </Paper>
      </Badge>
    ) : (
      <Paper className={cx(styles.dragPreview, 'u-p-half u-maw-5')}>
        <Typography>{fileName}</Typography>
      </Paper>
    )}
  </>
)

export default React.memo(DragPreview)
