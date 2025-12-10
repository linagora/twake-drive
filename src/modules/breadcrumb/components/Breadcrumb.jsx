import cx from 'classnames'
import PropTypes from 'prop-types'
import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useI18n } from 'twake-i18n'

import Icon from 'cozy-ui/transpiled/react/Icon'
import RightIcon from 'cozy-ui/transpiled/react/Icons/Right'
import Spinner from 'cozy-ui/transpiled/react/Spinner'

import styles from '@/modules/breadcrumb/styles/breadcrumb.styl'

const Breadcrumb = ({
  path,
  onBreadcrumbClick,
  opening,
  inlined,
  className = ''
}) => {
  const { t } = useI18n()
  const [deployed, setDeployed] = useState(false)
  const wrapperRef = useRef(null)

  const closeMenu = useCallback(() => {
    setDeployed(false)
  }, [setDeployed])

  const openMenu = useCallback(() => {
    setDeployed(true)
  }, [setDeployed])

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        closeMenu()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [wrapperRef, closeMenu])

  const toggleDeploy = () => (deployed ? closeMenu() : openMenu())

  if (!path) return false

  return (
    <div
      className={cx(
        styles['fil-path-backdrop'],
        { [styles['deployed']]: deployed },
        { [styles['inlined']]: inlined },
        className
      )}
    >
      <h2
        data-testid="path-title"
        className={styles['fil-path-title']}
        ref={wrapperRef}
        onClick={toggleDeploy}
      >
        {path.map((folder, index) => {
          const folderName =
            folder._id === 'io.cozy.files.shared-drives-dir'
              ? t('breadcrumb.title_shared_drives')
              : folder.name
          if (index < path.length - 1) {
            return (
              <span
                className={styles['fil-path-link']}
                onClick={e => {
                  e.stopPropagation()
                  onBreadcrumbClick(folder)
                }}
                key={index}
              >
                <span className={styles['fil-path-link-name']}>
                  {folderName}
                </span>
                <Icon
                  icon={RightIcon}
                  className={styles['fil-path-separator']}
                />
              </span>
            )
          } else {
            return (
              <span
                className={styles['fil-path-current']}
                onClick={e => {
                  e.stopPropagation()
                  if (path.length >= 2) toggleDeploy()
                }}
                key={index}
              >
                <span className={styles['fil-path-current-name']}>
                  {folderName}
                </span>
                {path.length >= 2 && (
                  <span className={styles['fil-path-down']} />
                )}

                {opening && <Spinner />}
              </span>
            )
          }
        })}
      </h2>
    </div>
  )
}

Breadcrumb.propTypes = {
  path: PropTypes.array,
  onBreadcrumbClick: PropTypes.func,
  opening: PropTypes.bool,
  inlined: PropTypes.bool,
  className: PropTypes.string
}

export default Breadcrumb
