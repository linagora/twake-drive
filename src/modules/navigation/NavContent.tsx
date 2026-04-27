import React from 'react'

import Avatar from 'cozy-ui/transpiled/react/Avatar'
import Badge from 'cozy-ui/transpiled/react/Badge'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'

import { getNavComponents } from '@/modules/navigation/navComponents'

interface NavContentProps {
  icon?: string
  badgeContent?: number
  label?: string
}

const NavContent: React.FC<NavContentProps> = ({
  icon,
  badgeContent,
  label
}) => {
  const { isDesktop } = useBreakpoints()
  const { NavIcon, NavText } = getNavComponents()

  if (badgeContent) {
    if (isDesktop) {
      return (
        <>
          {icon && <NavIcon icon={icon} />}
          <NavText>{label}</NavText>
          <Avatar
            color="var(--errorColor)"
            textColor="var(--white)"
            size="xs"
            className="u-ml-auto u-mr-1"
          >
            <span style={{ fontSize: '11px', lineHeight: '1rem' }}>
              {badgeContent > 99 ? '99+' : badgeContent}
            </span>
          </Avatar>
        </>
      )
    } else {
      return (
        <>
          {icon && (
            <Badge badgeContent={badgeContent} color="error" withBorder={false}>
              <NavIcon icon={icon} />
            </Badge>
          )}
          <NavText>{label}</NavText>
        </>
      )
    }
  }

  return (
    <>
      {icon && <NavIcon icon={icon} />}
      <NavText>{label}</NavText>
    </>
  )
}

export { NavContent }
