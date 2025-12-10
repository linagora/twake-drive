import React from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useI18n } from 'twake-i18n'

import { isQueryLoading, useClient, useQuery } from 'cozy-client'
import { getQualification } from 'cozy-client/dist/models/document'
import { themesList } from 'cozy-client/dist/models/document/documentTypeData'
import { isQualificationNote } from 'cozy-client/dist/models/document/documentTypeDataHelpers'
import { getBoundT } from 'cozy-client/dist/models/document/locales'
import flag from 'cozy-flags'
import Icon from 'cozy-ui/transpiled/react/Icon'
import IconStack from 'cozy-ui/transpiled/react/IconStack'
import FileDuotoneIcon from 'cozy-ui/transpiled/react/Icons/FileDuotone'
import FileTypeNoteIcon from 'cozy-ui/transpiled/react/Icons/FileTypeNote'
import NestedSelectResponsive from 'cozy-ui/transpiled/react/NestedSelect/NestedSelectResponsive'

import { LoaderModal } from '@/components/LoaderModal'
import { buildFileOrFolderByIdQuery } from '@/queries'

const getThemesList = () =>
  flag('hide.healthTheme.enabled')
    ? themesList.filter(theme => theme.label !== 'health')
    : themesList

const OptionIconStack = ({ icon }) => {
  return (
    <IconStack
      backgroundIcon={<Icon icon={FileDuotoneIcon} color="#E049BF" size={32} />}
      {...(icon && {
        foregroundIcon: <Icon icon={icon} color="#E049BF" size={16} />
      })}
    />
  )
}

const makeOptions = ({ t, scannerT, focusedId }) => {
  const themesWithNone = [
    {
      id: 'none',
      items: [],
      label: t('Scan.none')
    },
    ...getThemesList()
  ]
  return {
    focusedId,
    children: themesWithNone.map(theme => {
      return {
        id: theme.label,
        title:
          theme.id === 'none'
            ? t('Scan.none')
            : scannerT(`Scan.themes.${theme.label}`),
        icon: <OptionIconStack icon={theme.icon} />,
        children: theme.items.map(item => {
          return {
            id: item.label,
            item,
            title: scannerT(`Scan.items.${item.label}`),
            icon: isQualificationNote(item) ? (
              <Icon icon={FileTypeNoteIcon} size={64} />
            ) : (
              <OptionIconStack icon={item.icon} />
            )
          }
        })
      }
    })
  }
}

export const QualifyFileView = () => {
  const navigate = useNavigate()
  const { fileId } = useParams()
  const { t, lang } = useI18n()
  const client = useClient()
  const scannerT = getBoundT(lang || 'en')

  const fileQuery = buildFileOrFolderByIdQuery(fileId)
  const { data: file, ...fileQueryResult } = useQuery(
    fileQuery.definition,
    fileQuery.options
  )
  const qualificationLabel = getQualification(file)?.label
  const defaultOptions = makeOptions({
    t,
    scannerT,
    focusedId: qualificationLabel
  })

  const onClose = () => {
    navigate('..', { replace: true })
  }

  const handleClick = async ({ title, item }) => {
    const fileCollection = client.collection('io.cozy.files')
    const removeQualification = qualificationLabel && title === t('Scan.none')

    if (!qualificationLabel && removeQualification) {
      return onClose()
    }

    /*
      In the case where we remove the qualification it's necessary to define the attribute to `null` and not `undefined`, with `undefined` the stack does not return the attribute and today the Redux store is not updated for a missing attribute.
      As a result, the UI is not updated and continues to display the qualification on the document, even though it has been deleted in CouchDB.
    */
    await fileCollection.updateMetadataAttribute(file._id, {
      qualification: removeQualification ? null : item
    })
    onClose()
  }

  const isSelected = ({ title, item }) => {
    return qualificationLabel
      ? qualificationLabel === item?.label
      : title === t('Scan.none')
  }

  if (isQueryLoading(fileQueryResult)) {
    return <LoaderModal />
  }

  return (
    <NestedSelectResponsive
      title={file.name}
      options={defaultOptions}
      noDivider
      document={file}
      onSelect={handleClick}
      isSelected={isSelected}
      onClose={onClose}
    />
  )
}
