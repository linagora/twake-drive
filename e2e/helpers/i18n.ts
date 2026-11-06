import { readFileSync } from 'fs'
import path from 'path'

import Polyglot from 'node-polyglot'

/** The e2e instances are created with the `en` locale (see global-setup). */
const LOCALE = 'en'

/** Dictionaries of the libraries that render part of Drive's UI, by the
 * prefix that selects them in a key: `t('cozy-sharing:Share.recipients.you')`.
 * A key without a prefix is one of Drive's own. */
const DICTIONARIES: Record<string, string> = {
  drive: path.resolve(
    __dirname,
    '..',
    '..',
    'src',
    'locales',
    `${LOCALE}.json`
  ),
  'cozy-sharing': require.resolve(`cozy-sharing/locales/${LOCALE}.json`),
  'cozy-viewer': require.resolve(`cozy-viewer/src/locales/${LOCALE}.json`),
  'cozy-ui-member-row': require.resolve(
    `cozy-ui/react/MemberRow/locales/${LOCALE}.json`
  ),
  'cozy-ui-member-list': require.resolve(
    `cozy-ui/react/MemberList/locales/${LOCALE}.json`
  )
}

type Vars = Record<string, string | number>

const translators = new Map<string, Polyglot>()

const translator = (name: string): Polyglot => {
  const file = DICTIONARIES[name]
  if (!file) throw new Error(`No dictionary named ${name}`)
  let polyglot = translators.get(name)
  if (!polyglot) {
    polyglot = new Polyglot({
      locale: LOCALE,
      phrases: JSON.parse(readFileSync(file, 'utf8')),
      onMissingKey: (key: string): never => {
        throw new Error(`Missing translation ${name}:${key}`)
      }
    })
    translators.set(name, polyglot)
  }
  return polyglot
}

/** The text the app renders for a translation key, through node-polyglot as
 * the app does. */
export const t = (key: string, vars?: Vars): string => {
  const [name, localKey] = key.includes(':')
    ? key.split(':', 2)
    : ['drive', key]
  return translator(name).t(localKey, vars)
}
