import { render, screen } from '@testing-library/react'
import React from 'react'

import { RedirectEditor } from '@/modules/views/editor/RedirectEditor'
import { useEditorOpen } from '@/modules/views/editor/useEditorOpen'

jest.mock('@/modules/views/editor/useEditorOpen', () => ({
  useEditorOpen: jest.fn()
}))

const renderRedirectEditor = (props = {}) =>
  render(
    <RedirectEditor fileId="file-id" slug="excalidraw" {...props}>
      <div data-testid="editor" />
    </RedirectEditor>
  )

describe('RedirectEditor', () => {
  it('mounts the editor once the file is known to live here', () => {
    useEditorOpen.mockReturnValue('local')

    renderRedirectEditor()

    expect(screen.queryByTestId('editor')).toBeInTheDocument()
  })

  it('holds the editor back while the stack resolves the file', () => {
    useEditorOpen.mockReturnValue('loading')

    renderRedirectEditor()

    expect(screen.queryByTestId('editor')).toBe(null)
  })

  it('never mounts the editor on a copy we are leaving', () => {
    useEditorOpen.mockReturnValue('redirecting')

    renderRedirectEditor()

    expect(screen.queryByTestId('editor')).toBe(null)
  })

  it('resolves the file through its shared drive', () => {
    useEditorOpen.mockReturnValue('local')

    renderRedirectEditor({ driveId: 'drive-id', slug: 'pdf' })

    expect(useEditorOpen).toHaveBeenCalledWith({
      fileId: 'file-id',
      driveId: 'drive-id',
      slug: 'pdf'
    })
  })
})
