'use strict'

import React from 'react'
import renderer from 'react-test-renderer'
import { I18n } from 'twake-i18n'

import File from '../../src/components/File'

describe('File component', () => {
  it('should render a folder correctly', () => {
    const attrs = {
      id: '1234',
      name: 'Foo',
      type: 'directory',
      created_at: '2017-01-03T08:52:37.093020313Z'
    }
    const component = renderer.create(
      <I18n lang="en" dictRequire={() => ''}>
        <File attributes={attrs} />
      </I18n>
    )
    const tree = component.toJSON()
    expect(tree).toMatchSnapshot()
  })
})
