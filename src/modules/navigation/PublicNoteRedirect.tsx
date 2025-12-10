import React, { FC, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useI18n } from 'twake-i18n'

import { useClient } from 'cozy-client'
import { fetchURL } from 'cozy-client/dist/models/note'
import Empty from 'cozy-ui/transpiled/react/Empty'
import Icon from 'cozy-ui/transpiled/react/Icon'
import SadCozyIcon from 'cozy-ui/transpiled/react/Icons/SadCozy'
import Spinner from 'cozy-ui/transpiled/react/Spinner'

import { joinPath } from '@/lib/path'
import { DummyLayout } from '@/modules/layout/DummyLayout'

const PublicNoteRedirect: FC = () => {
  const { t } = useI18n()
  const { fileId, driveId } = useParams()
  const client = useClient()

  const [noteUrl, setNoteUrl] = useState<string | null>(null)
  const [fetchStatus, setFetchStatus] = useState<
    'failed' | 'loading' | 'pending' | 'loaded'
  >('pending')

  useEffect(() => {
    const fetchNoteUrl = async (fileId: string): Promise<void> => {
      setFetchStatus('loading')

      try {
        // Inside notes, we need to add / at the end of /public/ or /preview/ to avoid 409 error
        const pathname =
          location.pathname === '/'
            ? '/public/'
            : joinPath(location.pathname, '')
        const url = await fetchURL(
          client,
          {
            id: fileId
          },
          {
            driveId,
            pathname
          }
        )
        setNoteUrl(url)
        setFetchStatus('loaded')
      } catch (error) {
        setFetchStatus('failed')
      }
    }

    if (fileId) {
      void fetchNoteUrl(fileId)
    }
  }, [fileId, driveId, client])

  if (noteUrl) {
    window.location.href = noteUrl
  }

  return (
    <DummyLayout>
      {fetchStatus === 'failed' && (
        <Empty
          icon={<Icon icon={SadCozyIcon} color="var(--primaryColor)" />}
          title={t('PublicNoteRedirect.error.title')}
          text={t('PublicNoteRedirect.error.subtitle')}
        />
      )}
      {fetchStatus !== 'failed' && <Spinner size="xxlarge" middle noMargin />}
    </DummyLayout>
  )
}

export { PublicNoteRedirect }
