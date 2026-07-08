import { Icon, Globe } from '@linagora/twake-icons'
import React, { useState } from 'react'

import { useClient, useFetchShortcut } from 'cozy-client'

const FileIconShortcut = ({ file, size = 32 }) => {
  const client = useClient()
  const { shortcutImg } = useFetchShortcut(client, file.id)
  const [isBroken, setBroken] = useState(null)

  return (
    <>
      <div style={{ display: shortcutImg && !isBroken ? 'block' : 'none' }}>
        <img
          src={shortcutImg}
          width={size}
          height={size}
          onError={() => {
            setBroken(true)
          }}
        />
      </div>
      <div
        style={{
          display: !shortcutImg || isBroken ? 'block' : 'none'
        }}
      >
        <Icon icon={Globe} size={size} color="var(--iconTextColor)" />
      </div>
    </>
  )
}

export default FileIconShortcut
