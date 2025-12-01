import { render } from '@testing-library/react'
import React from 'react'

import FileIcon from './FileIcon'

jest.mock('cozy-flags', () => () => true)
// eslint-disable-next-line react/display-name
jest.mock('cozy-ui-plus/dist/FileImageLoader', () => () => (
  <div data-testid="FileImageLoader" />
))

describe('FileIcon', () => {
  it('should return file image loader when file is image', () => {
    // Given
    const file = { class: 'image' }

    // When
    const { getByTestId } = render(<FileIcon file={file} />)

    // Then
    expect(getByTestId('FileImageLoader')).toBeInTheDocument()
  })

  it('should return file image loader when file is pdf', () => {
    // Given
    const file = { class: 'pdf' }

    // When
    const { getByTestId } = render(<FileIcon file={file} />)

    // Then
    expect(getByTestId('FileImageLoader')).toBeInTheDocument()
  })
})
