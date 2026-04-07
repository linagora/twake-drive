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

const mapStateToProps = state => {
  const rawQueue = getUploadQueue(state)

  // Replace file.name with relativePath for display when available
  const queue = rawQueue.map(item => {
    if (!item.relativePath) return item
    return {
      ...item,
      file: {
        name: item.relativePath,
        type: item.file?.type,
        size: item.file?.size
      }
    }
  })

  return {
    queue,
    doneCount: getProcessed(state).length,
    successCount: getSuccessful(state).length
  }
}
const mapDispatchToProps = dispatch => ({
  purgeQueue: () => dispatch(purgeUploadQueue())
})

export default connect(mapStateToProps, mapDispatchToProps)(DumbUploadQueue)
