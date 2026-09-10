import { render, screen } from '@testing-library/react'
import React from 'react'

import Fallback from './Fallback'

jest.mock('./NoViewerButton', () => () => <div>NoViewerButton</div>)
jest.mock('./CallToAction', () => () => <div>CallToAction</div>)
jest.mock('./VideoFallback', () => () => <div>VideoFallback</div>)

describe('Fallback', () => {
  const t = jest.fn()

  it('should render video fallback for video files', () => {
    render(
      <Fallback
        file={{ class: 'video', name: 'video.mp4' }}
        url="https://example.localhost/video"
        t={t}
      />
    )

    expect(screen.getByText('VideoFallback')).toBeInTheDocument()
    expect(screen.queryByText('NoViewerButton')).not.toBeInTheDocument()
    expect(screen.queryByText('CallToAction')).not.toBeInTheDocument()
  })

  it('should render no viewer button and call to action for non video files', () => {
    render(
      <Fallback
        file={{ class: 'text', name: 'test.txt' }}
        url="https://example.localhost/file"
        t={t}
      />
    )

    expect(screen.getByText('NoViewerButton')).toBeInTheDocument()
    expect(screen.getByText('CallToAction')).toBeInTheDocument()
    expect(screen.queryByText('VideoFallback')).not.toBeInTheDocument()
  })
})
