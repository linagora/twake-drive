import React from 'react'

import { Content } from 'cozy-ui/transpiled/react/Layout'

import Main from '@/modules/layout/Main'
import FilePickerButton from '@/modules/navigation/components/FilePickerButton'

export const FilePickerDemoView = () => (
  <Main>
    <Content>
      <div data-testid="file-picker-demo">
        <FilePickerButton />
      </div>
    </Content>
  </Main>
)
