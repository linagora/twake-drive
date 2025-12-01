import { useCallback } from 'react'
import { useLocation, useResolvedPath, useNavigate } from 'react-router-dom'
import type { Path } from 'react-router-dom'

import { useClient, generateWebLink } from 'cozy-client'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'

import type { File } from '@/components/FolderPicker/types'
import { joinPath } from '@/lib/path'
import {
  computeFileType,
  computeApp,
  computePath
} from '@/modules/navigation/hooks/helpers'
import { usePublicContext } from '@/modules/public/PublicProvider'
import { getFolderPath } from '@/modules/routeUtils'
import { isOfficeEnabled as computeOfficeEnabled } from '@/modules/views/OnlyOffice/helpers'
import { useShell } from '@/hooks/useShell'

export interface LinkResult {
  app: string
  href: string
  to: Path
  openInNewTab: boolean
  isSharedDrive: boolean
}

interface UseFileLinkResult {
  link: LinkResult
  openLink: (evt: React.MouseEvent<HTMLElement>) => void
}

/**
 * useFileLink computes the link to open a file.
 *
 * forceFolderPath is used to force `/folder` in the path
 *
 * To categories files requires different logic for the moment we can distinguishing 10 different cases. You can find the full list in the computeFileType function.
 *
 * Based on this category, we can compute the path to open the file. This path is relative so in case it will be used inside Drive we need to resolve it to use it inside generateWebLink. To work with relative path allows us to use the same logic for both cases (eg. recent, sharing pages)
 *
 * After we will make two types of links:
 * - to: will be used to open the file inside Drive as it based on react-router-dom convention
 * - href: which is regular href that can be used inside a link
 *
 * The first one is useful for link inside Drive and the second one for link outside of external application (eg. Notes, Nextcloud) or that will be opened in a new tab be default.
 *
 */
const useFileLink = (
  file: File,
  { forceFolderPath }: { forceFolderPath?: boolean } = {}
): UseFileLinkResult => {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const client = useClient()
  const { isDesktop } = useBreakpoints()
  const isOfficeEnabled = computeOfficeEnabled(isDesktop)
  const { isPublic } = usePublicContext()
  const { runsInShell, openFileInParent } = useShell()

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
  const cozyUrl = client?.getStackClient().uri as string

  const type = computeFileType(file, {
    isOfficeEnabled,
    isPublic,
    cozyUrl
  })
  const app = computeApp(type)
  const path = computePath(file, {
    type,
    pathname,
    isPublic
  })

  const shouldBeOpenedInNewTab =
    type === 'shortcut' || type === 'nextcloud-file'

  const currentURL = new URL(window.location.href)
  const currentPathname = currentURL.pathname
  const currentSearchParams = currentURL.searchParams

  // we use relative path because by default react-router-dom will use the structure of routes
  // each level of the path don't have a route but we want to move relatively to the path
  // to have more explanation : https://reactrouter.com/en/main/components/link#relative
  let to = useResolvedPath(path, {
    relative: forceFolderPath ? 'route' : 'path'
  })
  if (forceFolderPath && !shouldBeOpenedInNewTab) {
    to = {
      ...to,
      pathname:
        (type === 'directory' ? '/folder' : getFolderPath(file.dir_id)) +
        to.pathname
    }
  }

  // we need to merge the searchParams of the current url and the new one created in computed path
  // for example, to keep the sharecode in public context
  const searchParams = new URLSearchParams({
    ...Object.fromEntries(currentSearchParams.entries()),
    ...Object.fromEntries(new URLSearchParams(to.search).entries())
  })

  // nextcloud-file is a special case because Nextcloud are not in cozy ecosystem
  // so we open their link directly
  const href =
    type === 'nextcloud-file'
      ? path
      : generateWebLink({
          slug: app,
          cozyUrl,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          subDomainType: client?.getInstanceOptions().subdomain,
          // Inside notes, we need to add / at the end of /public/ or /preview/ to avoid 409 error
          pathname:
            type === 'public-note-same-instance'
              ? joinPath(currentPathname, '')
              : currentPathname,
          searchParams: searchParams as unknown as unknown[],
          hash: to.pathname
        })

  const openLink = useCallback(
    (evt: React.MouseEvent<HTMLElement>) => {
      if (
        evt.ctrlKey ||
        evt.metaKey ||
        evt.shiftKey ||
        shouldBeOpenedInNewTab
      ) {
        window.open(href, '_blank')
      } else if (runsInShell && file.type && file.type === 'file') {
        if (file.name && file.name.endsWith('.docs-note')) {
          openFileInParent(file)
        } else {
          window.open(href, '_blank')
        }
      } else if (app === 'drive') {
        navigate(to)
      } else {
        window.location.href = href
      }
    },
    [
      app,
      href,
      navigate,
      to,
      shouldBeOpenedInNewTab,
      runsInShell,
      file,
      openFileInParent
    ]
  )

  return {
    link: {
      app,
      href,
      to,
      openInNewTab: shouldBeOpenedInNewTab
    },
    openLink
  }
}

export { useFileLink }
