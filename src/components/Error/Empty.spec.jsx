import { render, screen } from '@testing-library/react'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'

import { EmptyDrive, EmptyTrash } from './Empty'

import { ROUTER_FUTURE_FLAGS } from '@/constants/config'

jest.mock('@linagora/twake-icons', () => ({
  Icon: ({ icon, size }) => (
    <span
      data-testid="illustration"
      data-size={size}
      data-illustration={icon.illustrationName}
    />
  )
}))
jest.mock('@/assets/icons/illu-folder-empty.svg', () => {
  const FolderEmpty = () => null
  FolderEmpty.illustrationName = 'folder-empty'
  return FolderEmpty
})
jest.mock('@/assets/icons/illu-folder-empty-space.svg', () => {
  const FolderEmptySpace = () => null
  FolderEmptySpace.illustrationName = 'folder-empty-space'
  return FolderEmptySpace
})
jest.mock('@/assets/icons/illu-trash-empty.svg', () => {
  const TrashEmpty = () => null
  TrashEmpty.illustrationName = 'trash-empty'
  return TrashEmpty
})
jest.mock('cozy-ui/transpiled/react/providers/Breakpoints', () => ({
  __esModule: true,
  default: () => ({ isDesktop: true })
}))
jest.mock('twake-i18n', () => ({ useI18n: () => ({ t: key => key }) }))
jest.mock('@/hooks', () => ({
  useCurrentFolderId: () => 'folder-id',
  useDisplayedFolder: () => ({ displayedFolder: null })
}))
jest.mock('@/modules/shareddrives/hooks/useSharedDriveFolder', () => ({
  useSharedDriveFolder: () => ({ sharedDriveResult: null })
}))
jest.mock('@/modules/upload/UploadButton', () => ({
  UploadButton: () => null
}))

const renderAt = (pathname, ui) =>
  render(
    <MemoryRouter initialEntries={[pathname]} future={ROUTER_FUTURE_FLAGS}>
      {ui}
    </MemoryRouter>
  )

const getIllustration = () => screen.getByTestId('illustration')
const getContainer = () => getIllustration().parentElement

describe('Empty', () => {
  it('shows the folder illustration at 160 px in a 10 rem container in Drive', () => {
    renderAt('/folder/folder-id', <EmptyDrive />)

    expect(getIllustration().dataset.illustration).toBe('folder-empty')
    expect(getIllustration().dataset.size).toBe('160')
    expect(getContainer()).toHaveClass('styles__c-empty-img--medium___1d2Zd')
    expect(getContainer()).not.toHaveClass('spaceIllustration')
  })

  it('shows the Twake Space illustration at 100 px in a 100 px container in the embed', () => {
    renderAt('/embed/sharings/drive-id/folder-id', <EmptyDrive />)

    expect(getIllustration().dataset.illustration).toBe('folder-empty-space')
    expect(getIllustration().dataset.size).toBe('100')
    expect(getContainer()).toHaveClass('spaceIllustration')
    expect(getContainer()).not.toHaveClass(
      'styles__c-empty-img--medium___1d2Zd'
    )
  })

  it('keeps the trash illustration at 160 px in the embed', () => {
    renderAt('/embed/sharings/drive-id/trash', <EmptyTrash />)

    expect(getIllustration().dataset.illustration).toBe('trash-empty')
    expect(getIllustration().dataset.size).toBe('160')
    expect(getContainer()).not.toHaveClass('spaceIllustration')
  })
})
