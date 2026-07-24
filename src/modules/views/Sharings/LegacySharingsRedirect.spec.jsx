import { render, screen } from '@testing-library/react'
import React from 'react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'

import { LegacySharingsRedirect } from './LegacySharingsRedirect'

const LocationProbe = () => {
  const location = useLocation()
  return (
    <div data-testid="location">
      {location.pathname}
      {location.search}
    </div>
  )
}

describe('LegacySharingsRedirect', () => {
  it('replaces a pre-tab file URL with its default-tab route', async () => {
    render(
      <MemoryRouter
        initialEntries={['/sharings/folder-1/file/file-1?sort=name']}
      >
        <Routes>
          <Route
            path="/sharings/with-me/folder/:folderId/file/:fileId"
            element={<LocationProbe />}
          />
          <Route path="/sharings/*" element={<LegacySharingsRedirect />} />
        </Routes>
      </MemoryRouter>
    )

    expect(await screen.findByTestId('location')).toHaveTextContent(
      '/sharings/with-me/folder/folder-1/file/file-1?sort=name'
    )
  })

  it('replaces an unmatched nested tab URL with the tab root', async () => {
    render(
      <MemoryRouter initialEntries={['/sharings/by-me/unknown-junk']}>
        <Routes>
          <Route path="/sharings/by-me" element={<LocationProbe />} />
          <Route path="/sharings/*" element={<LegacySharingsRedirect />} />
        </Routes>
      </MemoryRouter>
    )

    expect(await screen.findByTestId('location')).toHaveTextContent(
      '/sharings/by-me'
    )
  })
})
