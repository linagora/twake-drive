import { useContext, useEffect, useMemo, useRef } from 'react'

import {
  createSyncingFakeFile,
  isThereFileReferencedBySharingId,
  removeSharingFromContext
} from './syncHelpers'

import AcceptingSharingContext from '@/lib/AcceptingSharingContext'

export const useSyncingFakeFile = ({ isEmpty, queryResults }) => {
  const { sharingsValue, setSharingsValue, fileValue } = useContext(
    AcceptingSharingContext
  )

  const sharingIds = useMemo(
    () => Object.keys(sharingsValue),
    [sharingsValue]
  )

  const isSharingContextEmpty = sharingIds.length <= 0

  // Detect which sharings are obsolete (real file has arrived in queryResults)
  const obsoleteSharingIds = useMemo(() => {
    if (isEmpty || isSharingContextEmpty) return []

    return sharingIds.filter(sharingId =>
      isThereFileReferencedBySharingId(queryResults, sharingId)
    )
  }, [isEmpty, isSharingContextEmpty, sharingIds, queryResults])

  // Track obsolete IDs in a ref so the effect doesn't depend on sharingsValue
  const obsoleteRef = useRef(obsoleteSharingIds)
  obsoleteRef.current = obsoleteSharingIds

  // Clean up obsolete sharings from context
  useEffect(() => {
    if (obsoleteRef.current.length === 0) return

    for (const sharingId of obsoleteRef.current) {
      removeSharingFromContext({ sharingsValue, setSharingsValue, sharingId })
    }
  }, [obsoleteSharingIds]) // eslint-disable-line react-hooks/exhaustive-deps

  // Return the first fake file that is still needed
  const syncingFakeFile = useMemo(() => {
    if (isEmpty || isSharingContextEmpty || fileValue) return null

    for (const sharingId of sharingIds) {
      if (obsoleteSharingIds.includes(sharingId)) continue

      const sharingValue = sharingsValue[sharingId]
      const fakeFile = createSyncingFakeFile({ sharingValue })
      if (fakeFile) return fakeFile
    }

    return null
  }, [
    isEmpty,
    isSharingContextEmpty,
    fileValue,
    sharingIds,
    obsoleteSharingIds,
    sharingsValue
  ])

  return { syncingFakeFile }
}
