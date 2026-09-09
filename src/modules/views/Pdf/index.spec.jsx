import { render, screen } from '@testing-library/react'
import React from 'react'
import { useParams } from 'react-router-dom'

import { useSharingContext } from 'cozy-sharing'
import CozyTheme from 'cozy-ui-plus/dist/providers/CozyTheme'

import Pdf from '@/modules/views/Pdf'
import { useEditorOpen } from '@/modules/views/editor/useEditorOpen'

jest.mock('react-router-dom', () => ({
  useParams: jest.fn(),
  Navigate: () => <div data-testid="navigate" />
}))
jest.mock('cozy-sharing', () => ({ useSharingContext: jest.fn() }))
jest.mock('@/components/useHead', () => jest.fn())
jest.mock('@/modules/views/editor/useEditorOpen', () => ({
  useEditorOpen: jest.fn()
}))
jest.mock('@/modules/views/Pdf/Editor', () => ({
  __esModule: true,
  default: () => <div data-testid="pdf-editor" />
}))

const renderPdf = () =>
  render(
    <CozyTheme>
      <Pdf />
    </CozyTheme>
  )

describe('Pdf', () => {
  beforeEach(() => {
    useParams.mockReturnValue({ fileId: 'file-id' })
    useSharingContext.mockReturnValue({
      hasWriteAccess: () => true,
      allLoaded: true
    })
  })

  it('sends a read-only recipient to the owner rather than back to their drive', () => {
    useSharingContext.mockReturnValue({
      hasWriteAccess: () => false,
      allLoaded: true
    })
    useEditorOpen.mockReturnValue('redirecting')

    renderPdf()

    expect(screen.queryByTestId('navigate')).toBe(null)
  })

  it('still bounces a read-only recipient off a document that lives here', () => {
    useSharingContext.mockReturnValue({
      hasWriteAccess: () => false,
      allLoaded: true
    })
    useEditorOpen.mockReturnValue('local')

    renderPdf()

    expect(screen.queryByTestId('navigate')).toBeInTheDocument()
  })

  it('resolves the document through its shared drive', () => {
    useParams.mockReturnValue({ fileId: 'file-id', driveId: 'drive-id' })
    useEditorOpen.mockReturnValue('local')

    renderPdf()

    expect(useEditorOpen).toHaveBeenCalledWith({
      fileId: 'file-id',
      driveId: 'drive-id',
      slug: 'pdf'
    })
  })
})
