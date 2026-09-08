import { render, screen } from '@testing-library/react'
import React from 'react'
import { useParams } from 'react-router-dom'

import { useSharingContext } from 'cozy-sharing'
import CozyTheme from 'cozy-ui-plus/dist/providers/CozyTheme'

import Excalidraw from '@/modules/views/Excalidraw'
import { useEditorOpen } from '@/modules/views/editor/useEditorOpen'

jest.mock('react-router-dom', () => ({ useParams: jest.fn() }))
jest.mock('cozy-sharing', () => ({ useSharingContext: jest.fn() }))
jest.mock('@/components/useHead', () => jest.fn())
jest.mock('@/modules/views/editor/useEditorOpen', () => ({
  useEditorOpen: jest.fn()
}))
jest.mock('@/modules/views/Excalidraw/Editor', () => ({
  __esModule: true,
  default: () => <div data-testid="excalidraw-editor" />
}))

const renderExcalidraw = () =>
  render(
    <CozyTheme>
      <Excalidraw />
    </CozyTheme>
  )

describe('Excalidraw', () => {
  beforeEach(() => {
    useParams.mockReturnValue({ fileId: 'file-id' })
    useSharingContext.mockReturnValue({ hasWriteAccess: () => true })
  })

  it('mounts the editor once the drawing is known to live here', () => {
    useEditorOpen.mockReturnValue('local')

    renderExcalidraw()

    expect(screen.queryByTestId('excalidraw-editor')).toBeInTheDocument()
  })

  it('holds the editor back while the stack resolves the drawing', () => {
    useEditorOpen.mockReturnValue('loading')

    renderExcalidraw()

    expect(screen.queryByTestId('excalidraw-editor')).toBe(null)
  })

  it('never mounts the editor on a copy we are leaving', () => {
    useEditorOpen.mockReturnValue('redirecting')

    renderExcalidraw()

    expect(screen.queryByTestId('excalidraw-editor')).toBe(null)
  })

  it('resolves the drawing through its shared drive', () => {
    useParams.mockReturnValue({ fileId: 'file-id', driveId: 'drive-id' })
    useEditorOpen.mockReturnValue('local')

    renderExcalidraw()

    expect(useEditorOpen).toHaveBeenCalledWith({
      fileId: 'file-id',
      driveId: 'drive-id',
      slug: 'excalidraw'
    })
  })
})
