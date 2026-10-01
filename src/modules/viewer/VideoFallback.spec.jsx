import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'

import VideoFallback from './VideoFallback'

jest.mock('./NoViewerButton', () => () => <div>Download button</div>)

describe('VideoFallback', () => {
  const t = key => {
    if (key === 'Viewer.error.noapp') {
      return 'No application can read this file.'
    }
    return key
  }

  const file = {
    class: 'video',
    mime: 'video/mp4',
    name: 'video.mp4'
  }

  let createElementSpy

  const mockCanPlayType = value => {
    const originalCreateElement = document.createElement.bind(document)
    createElementSpy = jest
      .spyOn(document, 'createElement')
      .mockImplementation(tagName => {
        const element = originalCreateElement(tagName)

        if (tagName === 'video') {
          element.canPlayType = jest.fn().mockReturnValue(value)
        }

        return element
      })
  }

  afterEach(() => {
    createElementSpy?.mockRestore()
  })

  it('should render the video player when mime type is supported', () => {
    mockCanPlayType('probably')

    const { container } = render(
      <VideoFallback file={file} url="https://example.localhost/video" t={t} />
    )

    expect(container.querySelector('video')).toBeInTheDocument()
    expect(
      screen.queryByText('No application can read this file.')
    ).not.toBeInTheDocument()
    expect(screen.getByText('Download button')).toBeInTheDocument()
  })

  it('should show an unsupported message when mime type is not supported', () => {
    mockCanPlayType('')

    const { container } = render(
      <VideoFallback file={file} url="https://example.localhost/video" t={t} />
    )

    expect(container.querySelector('video')).not.toBeInTheDocument()
    expect(screen.getByText('No application can read this file.')).toBeVisible()
    expect(screen.getByText('Download button')).toBeInTheDocument()
  })

  it('should fallback to unsupported message when the video fails to play', () => {
    mockCanPlayType('probably')

    const { container } = render(
      <VideoFallback file={file} url="https://example.localhost/video" t={t} />
    )
    const video = container.querySelector('video')

    fireEvent.error(video)

    expect(screen.getByText('No application can read this file.')).toBeVisible()
    expect(screen.getByText('Download button')).toBeInTheDocument()
  })
})
