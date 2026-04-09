import PropTypes from 'prop-types'
import React, { useEffect } from 'react'

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

  useEffect(() => {
    postReady({ clientUrl, id })
  }, [clientUrl, id])

  const handleChange = async selection => {
    const ids = Array.isArray(selection) ? selection : [selection]
    try {
      const results = await buildPickResult(client, ids, type)
      postDone({ clientUrl, id, results })
    } catch (_err) {
      postError({ clientUrl, id, message: ERROR_RESOLUTION_FAILED })
    }
  }

  const handleClose = () => {
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
