import PropTypes from 'prop-types'
import React from 'react'

import { useQuery, isQueryLoading, Q } from 'cozy-client'
import { LaunchTriggerCard } from 'cozy-harvest-lib'
import Divider from 'cozy-ui/transpiled/react/Divider'
import { useBreakpoints } from 'cozy-ui/transpiled/react/providers/Breakpoints'

import useDocument from '@/components/useDocument'
import {
  buildTriggersQueryByAccountId,
  buildFileOrFolderByIdQuery
} from '@/queries'

const HarvestBanner = ({ folderId }) => {
  const folder = useDocument('io.cozy.files', folderId)
  const { isMobile } = useBreakpoints()

  let konnectorSlug = undefined
  let accountId = undefined

  const fileId = folder?.relationships?.contents?.data?.[0]?.id
  const fileQuery = buildFileOrFolderByIdQuery(fileId)
  const file = useQuery(fileQuery.definition, {
    ...fileQuery.options,
    enabled: Boolean(fileId)
  })
  if (file.data) {
    konnectorSlug = file.data.cozyMetadata?.createdByApp
    accountId = file.data.cozyMetadata?.sourceAccount
  }
  const queryTriggers = buildTriggersQueryByAccountId(accountId)
  const { data: triggers, ...triggersQueryLeft } = useQuery(
    queryTriggers.definition,
    queryTriggers.options
  )
  const isTriggersLoading = isQueryLoading(triggersQueryLeft)
  const konnector = useQuery(
    Q('io.cozy.konnectors').getById(`io.cozy.konnectors/${konnectorSlug}`),
    {
      as: `io.cozy.konnectors/${konnectorSlug}`,
      enabled: Boolean(konnectorSlug),
      singleDocData: true
    }
  )

  if (!konnector.data || konnector.data.length === 0 || isTriggersLoading) {
    return null
  }

  return (
    <div className="u-mh-0-s u-mb-0-s u-mh-2 u-mb-1">
      <LaunchTriggerCard
        flowProps={{
          initialTrigger: triggers[0],
          konnector: konnector.data
        }}
        konnectorRoot={`harvest/${konnectorSlug}`}
      />
      {isMobile && (
        <Divider
          style={{
            height: 12,
            backgroundColor: 'var(--defaultBackgroundColor)'
          }}
        />
      )}
    </div>
  )
}

HarvestBanner.propTypes = {
  folderId: PropTypes.string.isRequired
}

export default HarvestBanner
