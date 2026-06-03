import React from 'react'

import { useClient } from 'cozy-client'

const HomeIcon = () => {
  const client = useClient()

  return (
    <div className="u-h-2 u-w-2 u-ml-1">
      <img
        className="u-w-100 u-h-100 u-maw-2 u-mah-2"
        src={`${client.getStackClient().uri}/assets/images/icon-cozy-home.svg`}
      />
    </div>
  )
}

export default HomeIcon
