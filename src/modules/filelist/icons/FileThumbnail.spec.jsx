import { render } from '@testing-library/react'
import React from 'react'

import FileThumbnail from './FileThumbnail'

import { ViewSwitcherContext } from '@/lib/ViewSwitcherContext'

const folder = {
  _id: 'folder',
  _type: 'io.cozy.files',
  type: 'directory',
  name: 'Photos'
}

function renderFolder(viewType) {
  return render(
    <ViewSwitcherContext.Provider value={{ viewType }}>
      <FileThumbnail file={folder} size={96} />
    </ViewSwitcherContext.Provider>
  )
}

describe('FileThumbnail folder background', () => {
  it('keeps the contrast background in list mode', () => {
    const { container } = renderFolder('list')

    expect(container.querySelector('svg')).toBeInTheDocument()
    expect(container.firstElementChild).toHaveStyle({
      backgroundColor: 'var(--contrastBackgroundColor)',
      width: '96px',
      height: '96px'
    })
  })

  it('leaves the folder background unset in grid mode', () => {
    const { container } = renderFolder('grid')

    expect(container.querySelector('svg')).toBeInTheDocument()
    expect(getComputedStyle(container.firstElementChild).backgroundColor).toBe(
      'rgba(0, 0, 0, 0)'
    )
    expect(container.firstElementChild).toHaveStyle({
      width: '96px',
      height: '96px'
    })
  })
})
