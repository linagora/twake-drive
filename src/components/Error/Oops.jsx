import PropTypes from 'prop-types'
import React from 'react'
import { useI18n } from 'twake-i18n'

import Button from 'cozy-ui/transpiled/react/Buttons'
import Empty from 'cozy-ui/transpiled/react/Empty'

import styles from './oops.styl'

import EmptyIcon from '@/assets/icons/icon-folder-broken.svg'

const reload = () => {
  window.location.reload()
}

const Oops = ({ title, icon }) => {
  const { t } = useI18n()

  return (
    <Empty
      title={title ? title : t('error.open_folder')}
      icon={icon ? icon : EmptyIcon}
      className={styles['oops']}
    >
      <Button onClick={reload} label={t('error.button.reload')} />
    </Empty>
  )
}

Oops.propTypes = {
  title: PropTypes.string,
  icon: PropTypes.node
}

export default Oops
