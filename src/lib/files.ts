import type CozyClient from 'cozy-client/types/CozyClient'
import type { IOCozyFile } from 'cozy-client/types/types'

import { DOCTYPE_FILES } from '@/lib/doctypes'

const PAGE_LIMIT = 100

type DriveId = string | null | undefined

interface StatByIdLinks {
  next?: string
}

interface StatByIdResult {
  included?: IOCozyFile[]
  links?: StatByIdLinks
}

interface TypedFileCollection {
  statById: (
    id: string,
    opts: Record<string, string | number>
  ) => Promise<StatByIdResult>
}

export interface PaginatedStatByIdResult {
  included: IOCozyFile[]
  nextCursor: string | null
}

const getNextCursor = (links?: StatByIdLinks): string | null => {
  const next = links?.next
  if (!next) return null
  const queryString = next.split('?')[1]
  if (!queryString) return null
  return new URLSearchParams(queryString).get('page[cursor]')
}

export const paginatedStatById =
  (client: CozyClient, driveId?: DriveId) =>
  async (
    folderId: string,
    cursor: string | null = null
  ): Promise<PaginatedStatByIdResult> => {
    const collection = client.collection(DOCTYPE_FILES, {
      driveId
    }) as unknown as TypedFileCollection

    const { included = [], links } = await collection.statById(folderId, {
      ...(cursor ? { 'page[cursor]': cursor } : {}),
      'page[limit]': PAGE_LIMIT
    })

    return {
      included,
      nextCursor: getNextCursor(links)
    }
  }
