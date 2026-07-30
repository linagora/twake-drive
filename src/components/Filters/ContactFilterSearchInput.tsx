import React, { type FormEvent, type ReactElement } from 'react'
import type Autosuggest from 'react-autosuggest'

import SearchBar from 'cozy-ui/transpiled/react/SearchBar'

function handleSearchSubmit(event: FormEvent<HTMLFormElement>): void {
  event.preventDefault()
}

function ContactFilterSearchInput({
  onBlur,
  onChange,
  onFocus,
  placeholder,
  value,
  ...inputProps
}: Autosuggest.RenderInputComponentProps): ReactElement {
  return (
    <SearchBar
      className="u-w-100"
      componentsProps={{
        inputBase: {
          inputProps
        }
      }}
      disabledClear
      elevation={0}
      onBlur={onBlur}
      onChange={onChange}
      onFocus={onFocus}
      onSubmit={handleSearchSubmit}
      placeholder={placeholder}
      value={value}
    />
  )
}

export { ContactFilterSearchInput }
