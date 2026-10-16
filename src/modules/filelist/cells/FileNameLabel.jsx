import PropTypes from 'prop-types'
import React from 'react'

import styles from '@/styles/filelist.styl'

export function FileNameLabel({ title, filename, extension }) {
  return (
    <div className={styles['fil-file-filename']}>
      <div className={styles['fil-file-filename-wrapper']}>
        <div
          data-testid="fil-file-filename-and-ext"
          className={styles['fil-file-filename-and-ext']}
          title={title}
        >
          {filename}
          {extension && (
            <span className={styles['fil-content-ext']}>{extension}</span>
          )}
        </div>
      </div>
    </div>
  )
}

FileNameLabel.propTypes = {
  title: PropTypes.string.isRequired,
  filename: PropTypes.string.isRequired,
  extension: PropTypes.string
}
