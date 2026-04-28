import cx from 'classnames'
import React, { useCallback, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import Icon from 'cozy-ui/transpiled/react/Icon'
import CheckCircleIcon from 'cozy-ui/transpiled/react/Icons/CheckCircle'
import CrossCircleIcon from 'cozy-ui/transpiled/react/Icons/CrossCircle'
import SpinnerIcon from 'cozy-ui/transpiled/react/Icons/Spinner'
import WarningIcon from 'cozy-ui/transpiled/react/Icons/Warning'
import LinearProgress from 'cozy-ui/transpiled/react/LinearProgress'
import List from 'cozy-ui/transpiled/react/List'
import ListItem from 'cozy-ui/transpiled/react/ListItem'
import ListItemIcon from 'cozy-ui/transpiled/react/ListItemIcon'
import ListItemText from 'cozy-ui/transpiled/react/ListItemText'
import Paper from 'cozy-ui/transpiled/react/Paper'
import Tooltip from 'cozy-ui/transpiled/react/Tooltip'
import Typography from 'cozy-ui/transpiled/react/Typography'
import Button from 'cozy-ui/transpiled/react/deprecated/Button'
import { useI18n } from 'twake-i18n'

import { getUploadQueue, purgeUploadQueue, status as uploadStatus } from '.'

import { DEFAULT_UPLOAD_PROGRESS_HIDE_DELAY } from '@/constants/config'
import getMimeTypeIcon from '@/lib/getMimeTypeIcon'

const {
  LOADING,
  PENDING,
  RESOLVING,
  CANCEL,
  CREATED,
  UPDATED,
  ERROR_STATUSES,
  DONE_STATUSES
} = uploadStatus

const IN_PROGRESS = new Set([PENDING, RESOLVING])

// For the determinate progress bar, weight each row by how far it's
// progressed: PENDING/RESOLVING contribute 0, LOADING contributes its
// loaded/total byte fraction, terminal statuses (success/error/cancel)
// contribute 1. Counts only matter as integers for the close-button
// gating; the bar uses the fractional total.
const summarise = queue => {
  let done = 0
  let success = 0
  let progressTotal = 0
  for (const item of queue) {
    if (IN_PROGRESS.has(item.status)) continue
    if (item.status === LOADING) {
      progressTotal += item.progress?.total
        ? item.progress.loaded / item.progress.total
        : 0
      continue
    }
    done++
    progressTotal += 1
    if (item.status === CREATED || item.status === UPDATED) success++
  }
  return { done, success, progressTotal }
}

const popoverStyle = {
  position: 'fixed',
  bottom: '0.5rem',
  right: '1.5rem',
  width: '30rem',
  maxWidth: '90%',
  height: '13.125rem',
  zIndex: 'var(--zIndex-popover, 1300)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  borderRadius: '0.5rem'
}

const headerStyle = {
  minHeight: '2rem',
  padding: '0.5rem 1rem',
  margin: 0,
  fontWeight: 'bold',
  backgroundColor: 'var(--defaultBackgroundColor)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between'
}

const contentStyle = {
  overflow: 'auto',
  flex: '1 1 auto',
  // Without min-height: 0 the flex item refuses to shrink below its
  // content size, so a long queue pushes header + progress bar
  // out of the popover's clipped area.
  minHeight: 0
}

const FileUploadProgress = ({ progress }) => {
  if (!progress?.total) return null
  return (
    <LinearProgress
      variant="determinate"
      value={(progress.loaded / progress.total) * 100}
    />
  )
}

const UploadItem = ({ item, t }) => {
  const { file, status, isDirectory, relativePath } = item
  const displayName = relativePath || file?.name || ''
  const isResolving = status === RESOLVING
  const isLoading = status === LOADING
  const isError = ERROR_STATUSES.includes(status)
  const isDone = DONE_STATUSES.includes(status)
  const isPending = status === PENDING

  let statusIcon = null
  if (isResolving || (isLoading && !item.progress)) {
    // Use Icon directly rather than cozy-ui's <Spinner>: Spinner wraps the
    // SVG in a div whose line-box baseline pushes the glyph ~2px above the
    // sibling label, which looks misaligned in the row.
    statusIcon = (
      <Icon icon={SpinnerIcon} color="var(--primaryColor)" spin size={16} />
    )
  } else if (status === CANCEL) {
    statusIcon = <Icon icon={CrossCircleIcon} color="var(--errorColor)" />
  } else if (isError) {
    statusIcon = <Icon icon={WarningIcon} color="var(--errorColor)" />
  } else if (isDone) {
    statusIcon = <Icon icon={CheckCircleIcon} color="var(--successColor)" />
  }

  let label = null
  if (isResolving) label = t('UploadQueue.item.preparing')
  else if (isPending) label = t('UploadQueue.item.pending')

  return (
    <ListItem
      divider
      data-testid="upload-queue-item"
      style={
        isError ? { backgroundColor: 'var(--errorBackground)' } : undefined
      }
    >
      <ListItemIcon className="u-ta-center">
        <Icon
          icon={getMimeTypeIcon(isDirectory, displayName, file?.type)}
          size={32}
          className="u-mr-1"
        />
      </ListItemIcon>
      <ListItemText
        disableTypography
        primary={
          // Tooltip only when the row carries a relative path — for
          // loose top-level files `displayName` is just the bare
          // filename and the tooltip would duplicate the visible label.
          relativePath ? (
            <Tooltip title={displayName} placement="top">
              <Typography
                variant="body1"
                className="u-ellipsis"
                data-testid="upload-queue-item-name"
              >
                {displayName}
              </Typography>
            </Tooltip>
          ) : (
            <Typography
              variant="body1"
              className="u-ellipsis"
              data-testid="upload-queue-item-name"
            >
              {displayName}
            </Typography>
          )
        }
        secondary={
          isLoading && item.progress ? (
            <FileUploadProgress progress={item.progress} />
          ) : null
        }
      />
      {statusIcon && <ListItemIcon>{statusIcon}</ListItemIcon>}
      {label && (
        <Typography
          variant="subtitle1"
          color="primary"
          className="u-ml-half u-flex-shrink-0"
        >
          {label}
        </Typography>
      )}
    </ListItem>
  )
}

const UploadQueue = () => {
  const { t } = useI18n()
  const dispatch = useDispatch()
  const queue = useSelector(getUploadQueue)
  const {
    done: doneCount,
    success: successCount,
    progressTotal
  } = summarise(queue || [])
  const purgeQueue = useCallback(() => dispatch(purgeUploadQueue()), [dispatch])
  const queueLength = queue?.length ?? 0
  // Everything in the queue has reached a terminal state (success or
  // error). Drives the "done" header copy + the manual close button.
  const allProcessed = queueLength > 0 && doneCount === queueLength
  // Stricter: every item succeeded. Drives auto-purge so failures stay
  // visible until the user dismisses them — auto-closing on partial
  // failures would hide the failed rows behind the toast alert.
  const allSucceeded = queueLength > 0 && successCount === queueLength
  const isResolving = (queue || []).some(item => item.status === RESOLVING)

  useEffect(() => {
    if (allSucceeded) {
      const timer = setTimeout(purgeQueue, DEFAULT_UPLOAD_PROGRESS_HIDE_DELAY)
      return () => clearTimeout(timer)
    }
  }, [allSucceeded, purgeQueue])

  if (queueLength === 0) return null

  let headerText
  if (isResolving) {
    // Count the whole drop, not just the resolving placeholders, so a
    // mixed drop (loose file + folder) reads as the user dropped it.
    headerText = t('UploadQueue.header_preparing', {
      smart_count: queueLength
    })
  } else if (allProcessed) {
    headerText = t('UploadQueue.header_done', {
      done: successCount,
      total: queueLength
    })
  } else {
    headerText = t('UploadQueue.header', { smart_count: queueLength })
  }

  return (
    <Paper
      elevation={6}
      style={popoverStyle}
      data-testid="upload-queue"
      className={cx({ 'upload-queue--resolving': isResolving })}
    >
      <h4 style={headerStyle}>
        <Typography variant="h6">{headerText}</Typography>
        {allProcessed && !isResolving && (
          <Button
            subtle
            className="u-mv-0"
            label={t('UploadQueue.close')}
            onClick={purgeQueue}
          />
        )}
      </h4>
      <LinearProgress
        variant={isResolving ? 'indeterminate' : 'determinate'}
        value={isResolving ? undefined : (progressTotal / queueLength) * 100}
        // flexShrink: 0 keeps the bar at its 4px intrinsic height when
        // the queue grows long. Without it, the flex algorithm splits
        // negative free space proportionally to flex-basis and shrinks
        // the bar to ~0px (the list wrapper's basis dwarfs the bar's).
        style={{ flexShrink: 0 }}
      />
      <div style={contentStyle}>
        <List className="u-pv-0">
          {queue.map(item => (
            <UploadItem key={item.fileId} item={item} t={t} />
          ))}
        </List>
      </div>
    </Paper>
  )
}

export default UploadQueue
