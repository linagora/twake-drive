import { getI18n } from 'twake-i18n'

import ar from './ar.json'
import cs from './cs.json'
import cs_CZ from './cs_CZ.json'
import de from './de.json'
import en from './en.json'
import es from './es.json'
import fr from './fr.json'
import it from './it.json'
import ja from './ja.json'
import ko from './ko.json'
import nl from './nl.json'
import nl_NL from './nl_NL.json'
import pl from './pl.json'
import ru from './ru.json'
import zh_CN from './zh_CN.json'
import zh_TW from './zh_TW.json'

export const locales = {
  ar,
  cs,
  cs_CZ,
  de,
  en,
  es,
  fr,
  it,
  ja,
  ko,
  nl,
  nl_NL,
  pl,
  ru,
  zh_CN,
  zh_TW
}

export const getDriveI18n = () => getI18n(undefined, lang => locales[lang])
