import { render } from '@testing-library/react'
import React from 'react'

import { createMockClient } from 'cozy-client'

import AppLike from 'test/components/AppLike'

import { ScribeIntent } from '@/modules/views/OnlyOffice/Scribe/ScribeIntent'
import { useScribe } from '@/modules/views/OnlyOffice/Scribe/ScribeProvider'

jest.mock('@/modules/views/OnlyOffice/Scribe/ScribeProvider', () => ({
  useScribe: jest.fn()
}))

const mockIntentIframe = jest.fn()
jest.mock('cozy-ui-plus/dist/Intent/IntentIframe', () => ({
  __esModule: true,
  default: props => {
    mockIntentIframe(props)
    return null
  }
}))

const setup = (props, scribe = {}) => {
  const onResult = jest.fn()
  const onCancel = jest.fn()
  useScribe.mockReturnValue({
    content: 'Un **texte**',
    target: 'selection',
    documentType: 'word',
    documentData: null,
    ...scribe
  })

  const { unmount } = render(
    <AppLike client={createMockClient({})}>
      <ScribeIntent
        layout="compact"
        source="selection"
        onResult={onResult}
        onCancel={onCancel}
        {...props}
      />
    </AppLike>
  )

  return { onResult, onCancel, unmount }
}

const getIntentProps = () => mockIntentIframe.mock.calls.at(-1)[0]

describe('ScribeIntent', () => {
  it('ends with the assistant, as it cancels or terminates', () => {
    const { onCancel } = setup()

    getIntentProps().onCancel()
    getIntentProps().onTerminate()

    expect(onCancel).toHaveBeenCalledTimes(2)
  })

  // The page of the assistant tells it is cancelled as it unloads with the
  // surface: the surface opened since stays
  it('ignores the end of an intent whose surface is gone', () => {
    const { onCancel, unmount } = setup()
    const { onCancel: cancelIntent } = getIntentProps()

    unmount()
    cancelIntent()

    expect(onCancel).not.toHaveBeenCalled()
  })

  it('lets the assistant ask for the document of a text document only', () => {
    setup()
    expect(getIntentProps().data.documentAvailable).toBe(true)

    setup({}, { documentType: 'slide', target: 'slide' })
    expect(getIntentProps().data.documentAvailable).toBe(false)
  })

  it('tells the assistant the rules of the markers of the text', () => {
    setup()
    expect(getIntentProps().data).not.toHaveProperty('rules')

    setup({}, { content: 'Un <u>texte</u>' })
    expect(getIntentProps().data.rules).toBe(
      'Keep the <u> and </u> tags around the underlined text, and do not add any.'
    )

    setup(
      {},
      {
        documentData: {
          document: 'Titre ![image 1]',
          documentTruncated: false
        }
      }
    )
    expect(getIntentProps().data).not.toHaveProperty('rules')
  })

  it('gives the assistant the document it asked for', () => {
    setup()
    expect(getIntentProps().data).not.toHaveProperty('document')
    expect(getIntentProps().data).not.toHaveProperty('documentTruncated')

    setup(
      {},
      {
        documentData: {
          document: 'Titre\n\nUn **texte**',
          documentTruncated: true
        }
      }
    )
    expect(getIntentProps().data).toMatchObject({
      content: 'Un **texte**',
      document: 'Titre\n\nUn **texte**',
      documentTruncated: true
    })
  })
})
