import { Icon, Peoples } from '@linagora/twake-icons'
import React from 'react'

import { MemberAvatar } from 'cozy-sharing'
import Avatar, { colorToGradient } from 'cozy-ui/transpiled/react/Avatar'

import type { SharingsContactFilterOptionData } from './sharingContactFilter'

interface SharingContactAvatarProps {
  option: SharingsContactFilterOptionData
}

function SharingContactAvatar({
  option
}: SharingContactAvatarProps): JSX.Element {
  if (option.kind === 'person') {
    return <MemberAvatar recipient={option.recipient} size="s" />
  }

  const color =
    typeof option.recipient.color === 'string'
      ? colorToGradient(option.recipient.color)
      : undefined

  return (
    <Avatar color={color} size="s">
      <Icon icon={Peoples} />
    </Avatar>
  )
}

export { SharingContactAvatar }
