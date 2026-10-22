import config from '../config.json'
import { makeToolbarItems, readEditorLang } from './toolbar'

const BASE_URL =
  'https://onlyoffice.example.org/9.4.0-1/sdkjs-plugins/twake-scribe/'
const EDITOR_URL =
  'https://onlyoffice.example.org/9.4.0-1/web-apps/apps/documenteditor/main/index.html'

const makeIcons = name =>
  `${BASE_URL}resources/%theme-type%(light|dark)/${name}%scale%(100).%extension%(png)`

const readLabels = ({ tabs }) =>
  tabs.flatMap(({ text, items }) => [
    ...(text === undefined ? [] : [text]),
    ...items.flatMap(item => [item.text, item.hint])
  ])

describe('makeToolbarItems', () => {
  it('labels the entries in French for a French editor', () => {
    expect(makeToolbarItems('fr-FR', BASE_URL)).toEqual({
      guid: config.guid,
      tabs: [
        {
          id: 'plugins',
          items: [
            {
              id: 'scribe',
              type: 'button',
              text: 'Scribe',
              hint: "Assistant d'écriture Scribe",
              icons: makeIcons('icon'),
              lockInViewMode: true
            }
          ]
        },
        {
          id: 'scribeAssistantTab',
          text: 'Assistant',
          items: [
            {
              id: 'scribeInline',
              type: 'button',
              text: 'Scribe en ligne',
              hint: 'Ouvrir Scribe sur le texte sélectionné',
              icons: makeIcons('icon-inline'),
              lockInViewMode: true
            },
            {
              id: 'scribePanel',
              type: 'button',
              text: 'Panneau Scribe',
              hint: 'Ouvrir ou fermer le panneau Scribe',
              icons: makeIcons('icon-panel'),
              lockInViewMode: true
            }
          ]
        }
      ]
    })
  })

  it('labels them in English otherwise', () => {
    for (const lang of ['en', 'en-GB', 'de', '']) {
      expect(readLabels(makeToolbarItems(lang, BASE_URL))).toEqual([
        'Scribe',
        'Scribe AI writing assistant',
        'Assistant',
        'Inline Scribe',
        'Open Scribe on the selected text',
        'Scribe panel',
        'Open or close the Scribe panel'
      ])
    }
  })
})

describe('readEditorLang', () => {
  it('reads the lang of the editor address', () => {
    expect(
      readEditorLang(`${EDITOR_URL}?_dc=9.4.0-1&lang=fr&frameEditorId=editor`)
    ).toBe('fr')
    expect(readEditorLang(`${EDITOR_URL}?_dc=9.4.0-1`)).toBe('en')
    expect(readEditorLang(`${EDITOR_URL}?lang=`)).toBe('en')
    expect(readEditorLang('not an address')).toBe('en')
  })
})
