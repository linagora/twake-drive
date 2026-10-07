import { render } from '@testing-library/react'
import React from 'react'

import { SharingShortcutIcon } from './SharingShortcutIcon'

import getMimeTypeIcon from '@/lib/getMimeTypeIcon'

jest.mock('@/lib/getMimeTypeIcon', () => jest.fn(() => () => null))

function makeShortcut(target) {
  return {
    _id: 'shortcut-id',
    name: 'Shared.url',
    metadata: { sharing: { status: 'new' }, target }
  }
}

describe('SharingShortcutIcon', () => {
  it('shows a folder icon when the target has no mime', () => {
    render(
      <SharingShortcutIcon
        file={makeShortcut({ _type: 'io.cozy.files' })}
        size={16}
      />
    )

    expect(getMimeTypeIcon).toHaveBeenCalledWith(true, 'Shared.url', undefined)
  })

  it('shows a file icon when the target has a mime', () => {
    render(
      <SharingShortcutIcon
        file={makeShortcut({ _type: 'io.cozy.files', mime: 'text/plain' })}
        size={16}
      />
    )

    expect(getMimeTypeIcon).toHaveBeenCalledWith(
      false,
      'Shared.url',
      'text/plain'
    )
  })
})
