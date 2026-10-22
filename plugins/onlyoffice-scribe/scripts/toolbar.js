// The entries of the scribe in the toolbar of the editor, for
// AddToolbarMenuItem

// The guid of config.json: the editor finds the plugin of the entries by it
const GUID = 'asc.{E4B4F030-94E5-48BE-A962-A6E87CB6262B}'

// The editor shows a text or a hint as it is given: a string, not a map of
// translations
const LABELS = {
  en: {
    tab: 'Assistant',
    scribe: 'Scribe',
    scribeHint: 'Scribe AI writing assistant',
    inline: 'Inline Scribe',
    inlineHint: 'Open Scribe on the selected text',
    panel: 'Scribe panel',
    panelHint: 'Open or close the Scribe panel'
  },
  fr: {
    tab: 'Assistant',
    scribe: 'Scribe',
    scribeHint: "Assistant d'écriture Scribe",
    inline: 'Scribe en ligne',
    inlineHint: 'Ouvrir Scribe sur le texte sélectionné',
    panel: 'Panneau Scribe',
    panelHint: 'Ouvrir ou fermer le panneau Scribe'
  }
}

// Only the images at 100 % exist: with more scales, the editor of a HiDPI
// screen would ask for an icon@2x.png
const makeIcons = (baseUrl, name) =>
  `${baseUrl}resources/%theme-type%(light|dark)/${name}%scale%(100).%extension%(png)`

const makeButton = (id, text, hint, icons) => ({
  id,
  type: 'button',
  text,
  hint,
  icons,
  lockInViewMode: true
})

export function makeToolbarItems(lang, baseUrl) {
  const labels = LABELS[lang.startsWith('fr') ? 'fr' : 'en']
  return {
    guid: GUID,
    tabs: [
      {
        id: 'plugins',
        items: [
          makeButton(
            'scribe',
            labels.scribe,
            labels.scribeHint,
            makeIcons(baseUrl, 'icon')
          )
        ]
      },
      {
        id: 'scribeAssistantTab',
        text: labels.tab,
        items: [
          makeButton(
            'scribeInline',
            labels.inline,
            labels.inlineHint,
            makeIcons(baseUrl, 'icon-inline')
          ),
          makeButton(
            'scribePanel',
            labels.panel,
            labels.panelHint,
            makeIcons(baseUrl, 'icon-panel')
          )
        ]
      }
    ]
  }
}

// The entry of the Plugins tab works on the selection, as the inline one
const INLINE_ENTRIES = ['scribe', 'scribeInline']

/**
 * The message for the app when an entry is clicked, or null: the entries that
 * work on the selection need a selected text
 */
export function makeOpenMessage(id, selectedText) {
  if (id === 'scribePanel') {
    return { type: 'twake-scribe:open', source: 'toolbar-panel' }
  }
  if (!INLINE_ENTRIES.includes(id) || !selectedText?.trim()) return null
  return { type: 'twake-scribe:open', source: 'toolbar-inline' }
}

// The api.js of the Document Server gives the editor the language of the app
// in the address of its frame
export function readEditorLang(href) {
  try {
    return new URL(href).searchParams.get('lang') || 'en'
  } catch {
    return 'en'
  }
}
