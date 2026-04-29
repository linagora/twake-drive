import React from 'react'

import { useClient } from 'cozy-client'
import { makeSharingLink } from 'cozy-client/dist/models/sharing'

import FilePicker from './FilePicker'

const Picker = ({ service }) => {
  const client = useClient()

  const handleClick = async fileId => {
    // TODO: check multiple sharing link issues
    // const [shareLinkTTL, shareLinkPermanent] = await Promise.all([
    //   makeSharingLink(client, [fileId], { ttl: '5m' }),
    //   makeSharingLink(client, [fileId])
    // ])

    // "http://drive.alice.cozy.localhost:8080/public?sharecode=efiOchmwc9oU#/" }
    // POST "http://alice.cozy.localhost:8080/files/downloads?Id=01c6d8cb446b41c3a71fe846bc0dcd46&Filename=La%20Suite%20documentation%20technique.pdf"
    // avec en Bearer le sharecode
    // GET "http://alice.cozy.localhost:8080/files/downloads/bd5db658030a6bd3/La%20Suite%20documentation%20technique.pdf?Dl=1"

    const sharingLink = await makeSharingLink(client, [fileId])

    // const url = new URL(sharingLink)
    // const searchParams = new URLSearchParams(url.search)
    // const sharecode = searchParams.get('sharecode')

    // const publicClient = new CozyClient({
    //   cozyUrl: client.getStackClient().uri,
    //   token: sharecode,
    //   useCustomStore: true
    // })

    // const downloadLink = await publicClient
    //   .collection('io.cozy.files')
    //   .getDownloadLinkById(fileId, 'test.pdf')

    service.terminate({ id: fileId, sharingLink })
  }

  return <FilePicker onChange={handleClick} />
}

export default Picker
