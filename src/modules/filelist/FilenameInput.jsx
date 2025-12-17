import cx from 'classnames'
import React, { Component } from 'react'
import { translate } from 'twake-i18n'

import { isDirectory } from 'cozy-client/dist/models/file'
import Button from 'cozy-ui/transpiled/react/Buttons'
import { Dialog } from 'cozy-ui/transpiled/react/CozyDialogs'
import Spinner from 'cozy-ui/transpiled/react/Spinner'

import styles from '@/styles/filenameinput.styl'

import { CozyFile } from '@/models'

const ENTER_KEY = 13
const ESC_KEY = 27

const valueIsEmpty = value => value.toString() === ''

class FilenameInput extends Component {
  constructor(props) {
    super(props)
    this.textInput = React.createRef()
    this.state = {
      value: props.name || '',
      working: false,
      error: false,
      isModalOpened: false
    }
    this.fileNameOnMount = props.name
    this.abort = this.abort.bind(this)
    this.save = this.save.bind(this)
    this.isSubmitting = false
  }

  handleKeyDown(e) {
    const { value } = this.state

    if (e.keyCode === ENTER_KEY) {
      if (valueIsEmpty(value)) {
        this.abort(true)
      } else {
        this.submit()
      }
    } else if (e.keyCode === ESC_KEY) {
      this.abort()
    }
  }

  handleChange(e) {
    const { onChange } = this.props

    const value = e.target.value
    this.setState({ value })
    onChange && onChange(value)
  }

  handleBlur() {
    const { value } = this.state
    if (valueIsEmpty(value)) {
      // For folder creation (no initial name), exit without notification (abort(false))
      // For file renaming (has initial name), show notification (abort(true))
      this.abort(!!this.fileNameOnMount)
    } else {
      this.submit()
    }
  }

  submit() {
    if (this.isSubmitting) return
    const { value } = this.state
    const { file } = this.props
    this.setState({ working: true, error: false })
    this.isSubmitting = true
    if (!this.fileNameOnMount) return this.save()
    if (file && !isDirectory(file)) {
      const previousExtension = CozyFile.splitFilename({
        name: this.fileNameOnMount,
        type: 'file'
      }).extension
      const newExtension = CozyFile.splitFilename({
        name: value,
        type: 'file'
      }).extension
      if (previousExtension !== newExtension) {
        this.setState({ isModalOpened: true })
      } else {
        this.save()
      }
    } else {
      this.save()
    }
  }

  save = async () => {
    const { onSubmit } = this.props
    const { value } = this.state

    if (!onSubmit) return
    try {
      await onSubmit(value)
    } catch (e) {
      this.setState({
        working: false,
        error: true
      })
    } finally {
      this.isSubmitting = false
    }
  }

  abort(accidental = false) {
    const { isModalOpened } = this.state
    const { onAbort } = this.props

    if (isModalOpened) this.setState({ isModalOpened: false })
    onAbort && onAbort(accidental)
    this.isSubmitting = false
  }

  handleFocus() {
    const { name, file } = this.props
    // the component is also display when creating a Folder, in which case there is no
    // name yet at first. So we don't want to call splitFilename in that case because
    // it would throw an error even if it works well. Let's remove sentry error noise.
    if (!name) return
    const { filename } = CozyFile.splitFilename({ name, type: 'file' })
    // Since we're mounting the component and focusing it at the same time
    // let's add a small timeout to be sure the ref is populated
    setTimeout(() => {
      if (this.textInput.current)
        this.textInput.current.setSelectionRange(
          0,
          isDirectory(file) ? name.length : filename.length
        )
    }, 5)
  }

  render() {
    const { value, working, error, isModalOpened } = this.state
    const { t, className, style } = this.props

    return (
      <div
        data-testid="name-input"
        className={cx(styles['fil-file-name-input'], className)}
        style={style}
      >
        <input
          type="text"
          value={value}
          ref={this.textInput}
          disabled={working}
          onChange={e => this.handleChange(e)}
          onFocus={() => this.handleFocus()}
          onBlur={() => this.handleBlur()}
          onKeyDown={e => this.handleKeyDown(e)}
          className={error ? styles['error'] : null}
          autoFocus="autofocus"
        />
        {working && <Spinner />}
        <Dialog
          onClose={this.abort}
          open={isModalOpened}
          title={t('RenameModal.title')}
          content={t('RenameModal.description')}
          actions={
            <>
              <Button
                variant="secondary"
                onClick={this.abort}
                label={t('RenameModal.cancel')}
              />
              <Button
                variant="primary"
                label={t('RenameModal.continue')}
                onClick={this.save}
              />
            </>
          }
          actionsLayout="row"
        />
      </div>
    )
  }
}

export default translate()(FilenameInput)
