import { fireEvent, render, screen } from '@testing-library/react'
import React from 'react'

import { createMockClient } from 'cozy-client'

import CreateDocumentItems from './CreateDocumentItems'
import AppLike from 'test/components/AppLike'

import { useIsNotesInstalled } from '@/hooks/useIsNotesInstalled'

jest.mock('@/hooks/useIsNotesInstalled', () => ({
  useIsNotesInstalled: jest.fn()
}))

describe('CreateDocumentItems on a public share link', () => {
  const setup = ({ canUpload, isNotesInstalled, client, onClick }) => {
    useIsNotesInstalled.mockReturnValue(isNotesInstalled)
    return render(
      <AppLike client={client ?? createMockClient({})}>
        <CreateDocumentItems
          isPublic
          canUpload={canUpload}
          displayedFolder={{ id: 'folder-1' }}
          isReadOnly={false}
          onClick={onClick ?? jest.fn()}
        />
      </AppLike>
    )
  }

  it('offers a note when the link can write and Notes is installed', () => {
    const { queryByTestId } = setup({
      canUpload: true,
      isNotesInstalled: true
    })

    expect(queryByTestId('create-a-note')).toBeInTheDocument()
  })

  it('tells the user and closes the menu when the note cannot be created', async () => {
    const client = createMockClient({})
    jest.spyOn(client, 'collection').mockReturnValue({
      create: jest.fn().mockRejectedValue(new Error('Forbidden'))
    })
    const onClick = jest.fn()
    setup({ canUpload: true, isNotesInstalled: true, client, onClick })

    fireEvent.click(screen.getByTestId('create-a-note'))

    expect(
      await screen.findByText('An error occurred, please try again.')
    ).toBeInTheDocument()
    expect(onClick).toHaveBeenCalled()
  })

  it.each([
    { canUpload: false, isNotesInstalled: true },
    { canUpload: true, isNotesInstalled: false },
    { canUpload: true, isNotesInstalled: null }
  ])(
    'offers no note when canUpload is $canUpload and Notes installed is $isNotesInstalled',
    props => {
      const { queryByTestId } = setup(props)

      expect(queryByTestId('create-a-note')).toBeNull()
    }
  )
})
