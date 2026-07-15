import { useCallback } from 'react'
import { useLocation, useResolvedPath, useNavigate } from 'react-router-dom'
import type { Path } from 'react-router-dom'

import { useClient, generateWebLink } from 'cozy-client'
import { useSharingContext } from 'cozy-sharing'
import useBreakpoints from 'cozy-ui/transpiled/react/providers/Breakpoints'

import type { File } from '@/components/FolderPicker/types'
import { joinPath } from '@/lib/path'
import {
  computeFileType,
  computeApp,
  computePath,
  getSharingsTabSearch
} from '@/modules/navigation/hooks/helpers'
import { usePublicContext } from '@/modules/public/PublicProvider'
import { getFolderPath } from '@/modules/routeUtils'
import { isExcalidrawEnabled as computeExcalidrawEnabled } from '@/modules/views/Excalidraw/helpers'
import { isOfficeEnabled as computeOfficeEnabled } from '@/modules/views/OnlyOffice/helpers'

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

interface SharingContextForFileLink {
  isOwner?: (docId: string) => boolean
  allLoaded?: boolean
  byDocId?: Record<string, unknown>
}

const computeIsSharingsOwner = ({
  file,
  pathname,
  isPublic,
  sharingContext
}: {
  file: File
  pathname: string
  isPublic: boolean
  sharingContext?: SharingContextForFileLink
}): boolean => {
  const isInSharings = pathname.startsWith('/sharings')
  const isKnownSharedDoc = Boolean(
    file._id && sharingContext?.byDocId?.[file._id]
  )

  return (
    !isPublic &&
    isInSharings &&
    isKnownSharedDoc &&
    Boolean(sharingContext?.allLoaded) &&
    Boolean(sharingContext?.isOwner?.(file._id))
  )
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
  const { pathname, search } = useLocation()
  const client = useClient()
  const { isDesktop } = useBreakpoints()
  const isOfficeEnabled = computeOfficeEnabled(isDesktop)
  const isExcalidrawEnabled = computeExcalidrawEnabled()
  const { isPublic } = usePublicContext()
  const sharingContext = useSharingContext() as
    | SharingContextForFileLink
    | undefined
  const isSharingsOwner = computeIsSharingsOwner({
    file,
    pathname,
    isPublic,
    sharingContext
  })

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const cozyUrl = client?.getStackClient().uri as string

  const type = computeFileType(file, {
    isOfficeEnabled,
    isExcalidrawEnabled,
    isPublic,
    cozyUrl
  })
  const app = computeApp(type)
  const path = computePath(file, {
    type,
    pathname,
    isPublic,
    client,
    isOwner: isSharingsOwner
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
  // The folder prefix only makes sense for a relative in-folder path. Types
  // that already resolve to an absolute route (e.g. shared-drive-file ->
  // /shareddrive/...) must be left untouched, otherwise the prefix produces a
  // malformed /folder/<dir_id>/shareddrive/... link.
  if (forceFolderPath && !shouldBeOpenedInNewTab && !path.startsWith('/')) {
    to = {
      ...to,
      pathname:
        (type === 'directory' ? '/folder' : getFolderPath(file.dir_id)) +
        to.pathname
    }
  }

  // The active sharings tab lives in ?tab= only: carry it over when the
  // in-app navigation stays under /sharings. Owner docs resolve to
  // /folder/... routes and deliberately leave the section, so they never
  // inherit it; a search already carried by the computed path wins.
  const tabSearch = getSharingsTabSearch(pathname, search)
  if (tabSearch && to.pathname.startsWith('/sharings') && !to.search) {
    to = { ...to, search: tabSearch }
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
      } else if (app === 'drive') {
        navigate(to)
      } else {
        window.location.href = href
      }
    },
    [app, href, navigate, to, shouldBeOpenedInNewTab]
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

export { computeIsSharingsOwner, useFileLink }
