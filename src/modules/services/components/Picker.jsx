import React from 'react'

import { useClient } from 'cozy-client'
import { makeSharingLink } from 'cozy-client/dist/models/sharing'
import FilePicker from 'cozy-ui-plus/dist/FilePicker'

const Picker = ({ service }) => {
  const client = useClient()

  const handleClick = async fileId => {
    // TODO: check multiple sharing link issues
    // const [shareLinkTTL, shareLinkPermanent] = await Promise.all([
    //   makeSharingLink(client, [fileId], { ttl: '5m' }),
    //   makeSharingLink(client, [fileId])
    // ])

    const sharingLink = await makeSharingLink(client, [fileId])
    service.terminate({ id: fileId, sharingLink })
  }

  return <FilePicker onChange={handleClick} />
}

export default Picker
