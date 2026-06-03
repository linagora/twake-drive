import React from 'react'

import { RealTimeQueries } from 'cozy-client'

import { NotFound } from '@/components/Error/NotFound'
import { ModalStack } from '@/lib/ModalContext'
import { ModalManager } from '@/lib/react-cozy-helpers'
import Main from '@/modules/layout/Main'

/**
 * Renders the FolderView component.
 *
 * @component
 * @param {Object} props - The component props.
 * @param {ReactNode} props.children - The child components to render.
 * @param {boolean} props.isNotFound - Indicates if the folder is not found.
 * @returns {ReactNode} The rendered FolderView component.
 */
const FolderView = ({ children, isNotFound }) => (
  <Main>
    <RealTimeQueries doctype="io.cozy.settings" />
    <ModalStack />
    <ModalManager />
    {isNotFound ? <NotFound /> : children}
  </Main>
)

export default React.memo(FolderView)
