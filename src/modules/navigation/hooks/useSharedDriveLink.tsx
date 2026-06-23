import { useCallback } from 'react'
import type { Path } from 'react-router-dom'
import { useResolvedPath, useNavigate } from 'react-router-dom'

import { useClient, generateWebLink } from 'cozy-client'

import {
  SharedDrive,
  getFolderIdFromSharing
} from '@/modules/shareddrives/helpers'

export interface LinkResult {
  app: string
  href: string
  to: Path
  openInNewTab: boolean
}

interface UseFileLinkResult {
  link: LinkResult
  openLink: (evt: React.MouseEvent<HTMLElement>) => void
}

const useSharedDriveLink = (sharing: SharedDrive): UseFileLinkResult => {
  const navigate = useNavigate()
  const client = useClient()

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const cozyUrl = client?.getStackClient().uri as string

  const app = 'drive'

  const folderId = getFolderIdFromSharing(sharing)

  if (!folderId) {
    throw new Error('Missing folder id in shared drive')
  }

  /** Set shared drive path
   * if user is owner of this shared drive, the path should be `folder/:folderId`
   * otherwise the path should be `shareddrive/:driveId/:folderId`
   */
  const path = sharing.owner
    ? `folder/${folderId}`
    : `shareddrive/${sharing._id}/${folderId}`

  const currentURL = new URL(window.location.href)
  const currentPathname = currentURL.pathname
  const currentSearchParams = currentURL.searchParams

  const to = useResolvedPath(path, {
    relative: 'route'
  })

  // we need to merge the searchParams of the current url and the new one created in computed path
  // for example, to keep the sharecode in public context
  const searchParams = new URLSearchParams({
    ...Object.fromEntries(currentSearchParams.entries())
  })

  // nextcloud-file is a special case because Nextcloud are not in cozy ecosystem
  // so we open their link directly
  const href = generateWebLink({
    slug: app,
    cozyUrl,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    subDomainType: client?.getInstanceOptions().subdomain,
    // Inside notes, we need to add / at the end of /public/ or /preview/ to avoid 409 error
    pathname: currentPathname,
    searchParams: searchParams as unknown as unknown[],
    hash: to.pathname
  })

  const openLink = useCallback(
    (evt: React.MouseEvent<HTMLElement>) => {
      if (evt.ctrlKey || evt.metaKey || evt.shiftKey) {
        window.open(href, '_blank')
      } else if (app === 'drive') {
        navigate(to)
      } else {
        window.location.href = href
      }
    },
    [app, href, navigate, to]
  )

  return {
    link: {
      app,
      href,
      to,
      openInNewTab: false
    },
    openLink
  }
}

export { useSharedDriveLink }
