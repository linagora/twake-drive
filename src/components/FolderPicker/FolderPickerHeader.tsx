import React from 'react'
import { useI18n } from 'twake-i18n'

import Card from 'cozy-ui/transpiled/react/Card'
import Typography from 'cozy-ui/transpiled/react/Typography'

import { FolderPickerHeaderIllustration } from '@/components/FolderPicker/FolderPickerHeaderIllustration'
import { FolderPickerEntry } from '@/components/FolderPicker/types'

interface FolderPickerHeaderProps {
  entries: FolderPickerEntry[]
  title?: string
  subTitle?: string
}

const specificCardStyle: React.CSSProperties = {
  marginLeft: '2rem',
  marginRight: '4rem',
  marginTop: '1rem',
  marginBottom: '1rem',
  background: 'var(--contrastBackgroundColor)',
  display: 'flex',
  alignItems: 'center',
  gap: '1rem'
}

const FolderPickerHeader: React.FC<FolderPickerHeaderProps> = ({
  entries,
  title,
  subTitle
}) => {
  const { t } = useI18n()
  const titleToUse = title
    ? title
    : t('Move.title', { smart_count: entries.length })
  const subTitleToUse = subTitle ? subTitle : t('Move.to')

  return (
    <Card inset style={specificCardStyle}>
      <FolderPickerHeaderIllustration entries={entries} />
      <div className="u-ellipsis">
        <Typography variant="h6" noWrap>
          {entries.length !== 1 ? titleToUse : entries[0].name}
        </Typography>
        <Typography variant="caption" color="textSecondary" noWrap>
          {subTitleToUse}
        </Typography>
      </div>
    </Card>
  )
}

export { FolderPickerHeader }
