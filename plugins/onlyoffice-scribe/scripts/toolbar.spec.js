import config from '../config.json'
import { makeOpenMessage, makeToolbarItems, readEditorLang } from './toolbar'

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
        'Scribe panel',
        'Open or close the Scribe panel'
      ])
    }
  })

  it('takes the labels the app gives, in the language of its user', () => {
    const labels = {
      tab: 'Assistent',
      scribeHint: 'Scribe, KI-Schreibassistent',
      panel: 'Scribe-Bereich',
      panelHint: 'Scribe-Bereich öffnen oder schließen'
    }

    expect(readLabels(makeToolbarItems('de', BASE_URL, labels))).toEqual([
      'Scribe',
      'Scribe, KI-Schreibassistent',
      'Assistent',
      'Scribe-Bereich',
      'Scribe-Bereich öffnen oder schließen'
    ])
  })

  it('keeps its own labels for those the app does not give as texts', () => {
    expect(
      readLabels(
        makeToolbarItems('fr', BASE_URL, { tab: 'Assistent', panel: 42 })
      )
    ).toEqual([
      'Scribe',
      "Assistant d'écriture Scribe",
      'Assistent',
      'Panneau Scribe',
      'Ouvrir ou fermer le panneau Scribe'
    ])
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

describe('makeOpenMessage', () => {
  it('asks the app to open or close the panel for both entries', () => {
    for (const id of ['scribe', 'scribePanel']) {
      expect(makeOpenMessage(id)).toEqual({
        type: 'twake-scribe:open',
        source: 'toolbar-panel'
      })
    }
  })

  it('sends nothing for another entry', () => {
    expect(makeOpenMessage('scribeToolbarBtn')).toBe(null)
  })
})
