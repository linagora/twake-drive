import CheckIcon from 'cozy-ui/transpiled/react/Icons/Check'
import GlobeIcon from 'cozy-ui/transpiled/react/Icons/Globe'
import PenIcon from 'cozy-ui/transpiled/react/Icons/Pen'
import MagicTrickIcon from 'cozy-ui/transpiled/react/Icons/MagicTrick'
import ContractIcon from 'cozy-ui/transpiled/react/Icons/Contract'
import ExpandIcon from 'cozy-ui/transpiled/react/Icons/Expand'
import ListIcon from 'cozy-ui/transpiled/react/Icons/List'
import CompanyIcon from 'cozy-ui/transpiled/react/Icons/Company'
import CocktailIcon from 'cozy-ui/transpiled/react/Icons/Cocktail'
import HandIcon from 'cozy-ui/transpiled/react/Icons/Hand'

/**
 * Map language codes to display names.
 */
const LANG_NAMES = {
  en: 'English',
  fr: 'Français',
  de: 'Deutsch',
  es: 'Español',
  it: 'Italiano',
  pt: 'Português',
  nl: 'Nederlands',
  pl: 'Polski',
  ru: 'Русский',
  ja: '日本語',
  ko: '한국어',
  ar: 'العربية',
  zh: '中文',
  vi: 'Tiếng Việt'
}

/**
 * Build the translate children list dynamically:
 * 1. Always "English"
 * 2. User's Cozy account language (if not English)
 * 3. Browser language (if different from the above)
 * Last item is a special { id: 'translate-custom', type: 'input' } for free text.
 *
 * @param {string} accountLang - Language code from Cozy account (e.g. 'fr')
 * @returns {Array} Translate sub-actions
 */
export function buildTranslateChildren(accountLang) {
  const seen = new Set()
  const children = []

  // 1. Always English
  seen.add('en')
  children.push({ id: 'translate-en', label: 'English', icon: null })

  // 2. Account language
  const acctCode = (accountLang || '').slice(0, 2).toLowerCase()
  if (acctCode && !seen.has(acctCode)) {
    seen.add(acctCode)
    const label = LANG_NAMES[acctCode] || accountLang
    children.push({ id: 'translate-' + acctCode, label, icon: null })
  }

  // 3. Browser language
  const browserCode = (navigator.language || '').slice(0, 2).toLowerCase()
  if (browserCode && !seen.has(browserCode)) {
    seen.add(browserCode)
    const label = LANG_NAMES[browserCode] || navigator.language
    children.push({ id: 'translate-' + browserCode, label, icon: null })
  }

  // 4. Custom input
  children.push({ id: 'translate-custom', label: '', icon: null, type: 'input' })

  return children
}

/**
 * Declarative action tree that drives the Scribe menu rendering.
 *
 * Each action has:
 * - id: unique identifier used by mockTransform and event handlers
 * - label: display text
 * - icon: cozy-ui icon component, 'emoji' string, or null
 * - children: array of sub-actions, or null for direct actions (no submenu)
 *   Translate children are built dynamically via buildTranslateChildren().
 */
export const SCRIBE_ACTIONS = [
  {
    id: 'correct-grammar',
    label: 'Correct grammar',
    icon: CheckIcon,
    children: null
  },
  {
    id: 'translate',
    label: 'Translate',
    icon: GlobeIcon,
    children: null // populated dynamically
  },
  {
    id: 'change-tone',
    label: 'Change tone',
    icon: PenIcon,
    children: [
      { id: 'tone-professional', label: 'More professional', icon: CompanyIcon },
      { id: 'tone-casual', label: 'More casual', icon: CocktailIcon },
      { id: 'tone-polite', label: 'More polite', icon: HandIcon }
    ]
  },
  {
    id: 'improve',
    label: 'Improve',
    icon: MagicTrickIcon,
    children: [
      { id: 'improve-shorter', label: 'Make it shorter', icon: ContractIcon },
      { id: 'improve-expand', label: 'Expand context', icon: ExpandIcon },
      { id: 'improve-emojify', label: 'Emojify', icon: 'emoji' },
      { id: 'improve-bullets', label: 'Transform to bullets', icon: ListIcon }
    ]
  }
]
