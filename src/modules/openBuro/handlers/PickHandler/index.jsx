import PropTypes from 'prop-types'
import React, { useEffect, useRef } from 'react'

import { useClient } from 'cozy-client'

import { buildPickResult } from './buildPickResult'
import { ERROR_RESOLUTION_FAILED } from '../../constants'
import {
  postCancelled,
  postDone,
  postError,
  postReady
} from '../../protocol/postResultToParent'

import FilePicker from '@/modules/services/components/FilePicker'

const PickHandler = ({ params }) => {
  const client = useClient()
  const { clientUrl, id, type, allowedMimeType, multiple } = params

  // FilePicker.handleConfirm fires onChange() and then onClose() synchronously
  // back-to-back. Without tracking the pick-in-progress state we'd always race
  // a postCancelled from handleClose against postDone from handleChange. In
  // popup mode that's not just noise: postCancelled closes the popup, which
  // terminates the async buildPickResult before postDone can fire, so the
  // embedder only ever sees "cancelled".
  const pickingRef = useRef(false)

  useEffect(() => {
    postReady({ clientUrl, id })
  }, [clientUrl, id])

  const handleChange = async selection => {
    pickingRef.current = true
    const ids = Array.isArray(selection) ? selection : [selection]
    try {
      const results = await buildPickResult(client, ids, type)
      postDone({ clientUrl, id, results })
    } catch (err) {
      // Surface the real cause in the popup console so integrators can see
      // what went wrong (network, payload encoding, postMessage size...).
      // The embedder only ever gets the canonical resolution-failed string.
      // eslint-disable-next-line no-console
      console.error('[openBuro] pick failed:', err)
      postError({ clientUrl, id, message: ERROR_RESOLUTION_FAILED })
    }
  }

  const handleClose = () => {
    if (pickingRef.current) return
    postCancelled({ clientUrl, id })
  }

  return (
    <FilePicker
      accept={allowedMimeType}
      multiple={multiple}
      onChange={handleChange}
      onClose={handleClose}
    />
  )
}

PickHandler.propTypes = {
  params: PropTypes.shape({
    clientUrl: PropTypes.string.isRequired,
    id: PropTypes.string.isRequired,
    type: PropTypes.arrayOf(PropTypes.string).isRequired,
    allowedMimeType: PropTypes.string,
    multiple: PropTypes.bool
  }).isRequired
}

export default PickHandler
