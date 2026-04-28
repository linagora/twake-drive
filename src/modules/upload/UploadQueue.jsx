import React, { useEffect } from 'react'
import { connect } from 'react-redux'

import UIUploadQueue from 'cozy-ui-plus/dist/UploadQueue'
import { translate } from 'twake-i18n'

import {
  getUploadQueue,
  getProcessed,
  getSuccessful,
  purgeUploadQueue
} from '.'

import { DEFAULT_UPLOAD_PROGRESS_HIDE_DELAY } from '@/constants/config'
import getMimeTypeIcon from '@/lib/getMimeTypeIcon'

export const DumbUploadQueue = translate()(props => {
  const { successCount, purgeQueue, queue, doneCount } = props

  useEffect(() => {
    const hasItems = (queue?.length ?? 0) > 0
    const allDone =
      successCount === doneCount && successCount === (queue?.length ?? 0)

    if (hasItems && allDone) {
      const timer = setTimeout(() => {
        purgeQueue()
      }, DEFAULT_UPLOAD_PROGRESS_HIDE_DELAY)
      return () => clearTimeout(timer)
    }
  }, [successCount, purgeQueue, queue, doneCount])

  return (
    <UIUploadQueue
      popover={true}
      getMimeTypeIcon={getMimeTypeIcon}
      app="Cozy Drive"
      {...props}
    />
  )
})

/**
 * Project an upload queue so items that came from a folder drop show
 * their relative path ("photos/2024/img.jpg") in the UI instead of the
 * bare filename.
 *
 * Memoised on two levels so progress ticks don't force every row to
 * re-render: the outer cache returns the same output array when the
 * queue reference hasn't changed, and the inner `WeakMap` returns the
 * same projected item when the underlying queue item hasn't changed
 * (so stable items keep stable references through `connect`).
 *
 * @param {Array<{fileId: string, file: File, relativePath: string|null, folderId: string}>} queue
 * @returns {Array} Queue items with `file.name` replaced by
 *   `relativePath` where applicable.
 */
const projectQueue = (() => {
  let lastQueue = null
  let lastOutput = null
  const projectedItems = new WeakMap()

  const projectItem = item => {
    if (!item.relativePath && item.status !== 'resolving') return item
    const cached = projectedItems.get(item)
    if (cached) return cached
    // Folder placeholders show up as a "pending" row so cozy-ui-plus
    // renders the familiar waiting indicator while the tree is being
    // resolved. The row is replaced in-place by real file items once
    // RESOLVE_FOLDER_ITEMS lands.
    const projected = {
      ...item,
      status: item.status === 'resolving' ? 'pending' : item.status,
      file: {
        name: item.relativePath || item.file?.name,
        type: item.file?.type,
        size: item.file?.size
      }
    }
    projectedItems.set(item, projected)
    return projected
  }

  return queue => {
    if (queue === lastQueue) return lastOutput
    lastQueue = queue
    lastOutput = queue.map(projectItem)
    return lastOutput
  }
})()

const mapStateToProps = state => ({
  queue: projectQueue(getUploadQueue(state)),
  doneCount: getProcessed(state).length,
  successCount: getSuccessful(state).length
})
const mapDispatchToProps = dispatch => ({
  purgeQueue: () => dispatch(purgeUploadQueue())
})

export default connect(mapStateToProps, mapDispatchToProps)(DumbUploadQueue)
