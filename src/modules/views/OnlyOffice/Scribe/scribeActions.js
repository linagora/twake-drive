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
  children.push({
    id: 'translate-en',
    label: 'English',
    icon: null,
    prompt: 'Translate the following text to English:\n\n{selectedText}',
    mockResult: 'wrap:[EN] Translation::[/EN]'
  })

  // 2. Account language
  const acctCode = (accountLang || '').slice(0, 2).toLowerCase()
  if (acctCode && !seen.has(acctCode)) {
    seen.add(acctCode)
    const label = LANG_NAMES[acctCode] || accountLang
    children.push({
      id: 'translate-' + acctCode,
      label,
      icon: null,
      prompt: 'Translate the following text to ' + label + ':\n\n{selectedText}',
      mockResult: 'wrap:[' + acctCode.toUpperCase() + '] Translation::[/' + acctCode.toUpperCase() + ']'
    })
  }

  // 3. Browser language
  const browserCode = (navigator.language || '').slice(0, 2).toLowerCase()
  if (browserCode && !seen.has(browserCode)) {
    seen.add(browserCode)
    const label = LANG_NAMES[browserCode] || navigator.language
    children.push({
      id: 'translate-' + browserCode,
      label,
      icon: null,
      prompt: 'Translate the following text to ' + label + ':\n\n{selectedText}',
      mockResult: 'wrap:[' + browserCode.toUpperCase() + '] Translation::[/' + browserCode.toUpperCase() + ']'
    })
  }

  // 4. Custom input
  children.push({
    id: 'translate-custom',
    label: '',
    icon: null,
    type: 'input',
    prompt: 'Translate the following text to {language}:\n\n{selectedText}',
    mockResult: 'wrap:[{language}] Translation::[/{language}]'
  })

  return children
}

/**
 * Declarative action tree that drives the Scribe menu rendering.
 *
 * Each action has:
 * - id: unique identifier used by mockTransform and event handlers
 * - label: display text
 * - icon: cozy-ui icon component, 'emoji' string, or null
 * - prompt: AI prompt template with {selectedText} placeholder (null for parent actions)
 * - mockResult: instruction for mockTransform output (null for parent actions)
 * - children: array of sub-actions, or null for direct actions (no submenu)
 *   Translate children are built dynamically via buildTranslateChildren().
 */
export const SCRIBE_ACTIONS = [
  {
    id: 'correct-grammar',
    label: 'Correct grammar',
    icon: CheckIcon,
    children: null,
    prompt: 'Correct the grammar and spelling of the following text:\n\n{selectedText}',
    mockResult: 'capitalize'
  },
  {
    id: 'translate',
    label: 'Translate',
    icon: GlobeIcon,
    children: null, // populated dynamically
    prompt: null,
    mockResult: null
  },
  {
    id: 'change-tone',
    label: 'Change tone',
    icon: PenIcon,
    prompt: null,
    mockResult: null,
    children: [
      {
        id: 'tone-professional',
        label: 'More professional',
        icon: CompanyIcon,
        prompt: 'Rewrite the following text in a more professional tone:\n\n{selectedText}',
        mockResult: 'wrap:Dear Sir/Madam,:Best regards.'
      },
      {
        id: 'tone-casual',
        label: 'More casual',
        icon: CocktailIcon,
        prompt: 'Rewrite the following text in a more casual, friendly tone:\n\n{selectedText}',
        mockResult: 'wrap:Hey!:Cheers!'
      },
      {
        id: 'tone-polite',
        label: 'More polite',
        icon: HandIcon,
        prompt: 'Rewrite the following text in a more polite and courteous tone:\n\n{selectedText}',
        mockResult: 'wrap:If I may,:Thank you kindly.'
      }
    ]
  },
  {
    id: 'improve',
    label: 'Improve',
    icon: MagicTrickIcon,
    prompt: null,
    mockResult: null,
    children: [
      {
        id: 'improve-shorter',
        label: 'Make it shorter',
        icon: ContractIcon,
        prompt: 'Make the following text shorter and more concise while preserving the key meaning:\n\n{selectedText}',
        mockResult: 'truncate-half'
      },
      {
        id: 'improve-expand',
        label: 'Expand context',
        icon: ExpandIcon,
        prompt: 'Expand the following text with additional context, detail and explanation:\n\n{selectedText}',
        mockResult: 'suffix: (expanded with additional context and detail)'
      },
      {
        id: 'improve-emojify',
        label: 'Emojify',
        icon: 'emoji',
        prompt: 'Add relevant emojis to the following text to make it more expressive:\n\n{selectedText}',
        mockResult: 'emojify'
      },
      {
        id: 'improve-bullets',
        label: 'Transform to bullets',
        icon: ListIcon,
        prompt: 'Transform the following text into a bullet-point list:\n\n{selectedText}',
        mockResult: 'bullets'
      }
    ]
  }
]

/**
 * Configuration for the free-prompt action.
 * promptPrefix can be set to a system instruction in the future.
 */
export const FREE_PROMPT_CONFIG = {
  id: 'free-prompt',
  promptPrefix: '',
  mockResult: 'wrap:[Custom: applied]:[/Custom]'
}
