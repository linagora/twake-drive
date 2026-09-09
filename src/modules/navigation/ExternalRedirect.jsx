import { Globe } from '@linagora/twake-icons'
import React from 'react'
import { useParams } from 'react-router-dom'

import { useClient, useFetchShortcut } from 'cozy-client'
import Empty from 'cozy-ui/transpiled/react/Empty'
import { translate } from 'twake-i18n'

import EmptyIcon from '@/assets/icons/icon-folder-broken.svg'
import { DummyLayout } from '@/modules/layout/DummyLayout'

export const isNavigableUrl = url => {
  try {
    const { protocol } = new URL(url)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

const ExternalRedirect = ({ t }) => {
  const { fileId } = useParams()
  const client = useClient()
  const { shortcutInfos, fetchStatus } = useFetchShortcut(client, fileId)
  const url = shortcutInfos?.data.attributes.url
  const isLoaded = fetchStatus === 'loaded'
  const hasFailed =
    fetchStatus === 'failed' || (isLoaded && (!url || !isNavigableUrl(url)))
  if (isLoaded && !hasFailed) {
    // eslint-disable-next-line react-hooks/immutability
    window.location.href = url
  }

  return (
    <DummyLayout>
      {hasFailed && (
        <Empty
          data-testid="empty-share"
          icon={EmptyIcon}
          title={t('External.redirection.title')}
          text={t('External.redirection.error')}
        />
      )}
      {!hasFailed && (
        <Empty
          data-testid="empty-share"
          icon={Globe}
          title={t('External.redirection.title')}
          text={t('External.redirection.text')}
        />
      )}
    </DummyLayout>
  )
}

export default translate()(ExternalRedirect)
