import React, { forwardRef } from 'react'
import { Link } from 'react-router-dom'

import type { LinkResult } from '@/modules/navigation/hooks/useFileLink'

interface FileLinkProps {
  link: LinkResult
  children: React.ReactNode
  [key: string]: unknown
}

const FileLink = forwardRef<HTMLAnchorElement, FileLinkProps>(
  function FileLinkComponent({ link, children, ...props }, ref) {
    const openInNewTab = link.openInNewTab
      ? { target: '_blank', rel: 'noopener noreferrer' }
      : {}

    if (link.app === 'drive') {
      return (
        <Link to={link.to} {...openInNewTab} {...props} ref={ref}>
          {children}
        </Link>
      )
    }

    return (
      <a href={link.href} {...openInNewTab} {...props} ref={ref}>
        {children}
      </a>
    )
  }
)

export { FileLink }
