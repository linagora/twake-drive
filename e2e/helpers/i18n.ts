import { readFileSync } from 'fs'
import path from 'path'

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
  )
}

type Vars = Record<string, string | number>

const loaded = new Map<string, unknown>()

const dictionary = (name: string): unknown => {
  const file = DICTIONARIES[name]
  if (!file) throw new Error(`No dictionary named ${name}`)
  if (!loaded.has(name)) {
    loaded.set(name, JSON.parse(readFileSync(file, 'utf8')))
  }
  return loaded.get(name)
}

const child = (node: unknown, part: string): unknown =>
  node !== null && typeof node === 'object'
    ? (node as Record<string, unknown>)[part]
    : undefined

const phrase = (name: string, key: string): string => {
  const text = key.split('.').reduce(child, dictionary(name))
  if (typeof text !== 'string') {
    throw new Error(`Missing translation ${name}:${key}`)
  }
  return text
}

/** The English form is the first of the `||||`-separated ones for 1 and the
 * second otherwise. */
const pluralForm = (text: string, count: string | number): string => {
  const forms = text.split('||||')
  return (forms[count === 1 ? 0 : 1] || forms[0]).trim()
}

const interpolate = (text: string, vars: Vars): string =>
  text.replace(/%\{(.*?)\}/g, (expression, name: string) =>
    name in vars ? String(vars[name]) : expression
  )

/**
 * The text the app renders for a translation key. It follows node-polyglot,
 * which the app translates with: with `smart_count`, the plural form is
 * picked first, then each `%{name}` takes its value from `vars`.
 */
export const t = (key: string, vars?: Vars): string => {
  const [name, localKey] = key.includes(':')
    ? key.split(':', 2)
    : ['drive', key]
  const text = phrase(name, localKey)
  if (!vars) return text
  return interpolate(
    vars.smart_count === undefined ? text : pluralForm(text, vars.smart_count),
    vars
  )
}
