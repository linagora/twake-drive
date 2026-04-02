const PAGE_LIMIT = 100

export const paginatedStatById =
  (client, driveId) => async (folderId, cursor) => {
    const collection = client.collection('io.cozy.files', { driveId })

    const { included, links } = await collection.statById(folderId, {
      ...(cursor ? { 'page[cursor]': cursor } : {}),
      'page[limit]': PAGE_LIMIT
    })

    let nextCursor = null
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
