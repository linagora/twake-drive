import CozyClient from 'cozy-client'
import type { IOCozyFile } from 'cozy-client/types/types'

const PAGE_LIMIT = 100

interface StatByIdLinks {
  next?: string
}

interface StatByIdResult {
  included: IOCozyFile[]
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

export const paginatedStatById =
  (client: CozyClient, driveId: string) =>
  async (
    folderId: string,
    cursor: string | null = null
  ): Promise<PaginatedStatByIdResult> => {
    const collection = client.collection('io.cozy.files', {
      driveId
    }) as unknown as TypedFileCollection

    const { included = [], links } = await collection.statById(folderId, {
      ...(cursor ? { 'page[cursor]': cursor } : {}),
      'page[limit]': PAGE_LIMIT
    })

    let nextCursor: string | null = null
    if (links?.next) {
      try {
        const queryString = links.next.split('?')[1]
        if (queryString) {
          const params = new URLSearchParams(queryString)
          nextCursor = params.get('page[cursor]')
        }
      } catch {
        nextCursor = null
      }
    }

    return { included, nextCursor }
  }
