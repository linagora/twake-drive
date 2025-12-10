import React, { useEffect } from 'react'
import { connect } from 'react-redux'
import { translate } from 'twake-i18n'

import UIUploadQueue from 'cozy-ui-plus/dist/UploadQueue'

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

const mapStateToProps = state => ({
  queue: getUploadQueue(state),
  doneCount: getProcessed(state).length,
  successCount: getSuccessful(state).length
})
const mapDispatchToProps = dispatch => ({
  purgeQueue: () => dispatch(purgeUploadQueue())
})

export default connect(mapStateToProps, mapDispatchToProps)(DumbUploadQueue)
