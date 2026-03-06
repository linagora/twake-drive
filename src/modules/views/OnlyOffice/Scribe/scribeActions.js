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
 * Sort translate children using 'by-language-frequency' strategy:
 * 1. English always first
 * 2. Account language second (if not English)
 * 3. Remaining languages sorted alphabetically by native name
 * Non-language entries (type: 'input') are appended at the end.
 *
 * @param {Array} children - children from SCRIBE_ACTIONS translate entry
 * @param {string} accountLang - Language code from Cozy account (e.g. 'fr')
 * @returns {Array} Sorted translate sub-actions
 */
export function buildTranslateChildren(accountLang) {
  var translateAction = SCRIBE_ACTIONS.find(function (a) { return a.id === 'translate' })
  var all = translateAction.children
  var acctCode = (accountLang || '').slice(0, 2).toLowerCase()

  var langs = all.filter(function (c) { return c.type !== 'input' })
  var other = all.filter(function (c) { return c.type === 'input' })

  var enChild = langs.find(function (c) { return c.id === 'translate-en' })
  var acctChild = acctCode && acctCode !== 'en'
    ? langs.find(function (c) { return c.id === 'translate-' + acctCode })
    : null

  var remaining = langs.filter(function (c) {
    return c !== enChild && c !== acctChild
  }).sort(function (a, b) {
    return a.label.localeCompare(b.label)
  })

  var sorted = [enChild]
  if (acctChild) { sorted.push(acctChild) }
  sorted = sorted.concat(remaining).concat(other)

  return sorted
}

/**
 * Declarative action tree that drives the Scribe menu rendering.
 *
 * Each action has:
 * - id: unique identifier used by mockTransform and event handlers
 * - labelKey: i18n key for display text (resolved via t() at render time)
 * - icon: cozy-ui icon component, 'emoji' string, or null
 * - prompt: AI prompt template with {selectedText} placeholder (null for parent actions)
 * - mockResult: instruction for mockTransform output (null for parent actions)
 * - children: array of sub-actions, or null for direct actions (no submenu)
 *   Translate children are built dynamically via buildTranslateChildren().
 *
 * prompt fields are LLM instructions — do NOT translate
 */
export const SCRIBE_ACTIONS = [
  {
    id: 'correct-grammar',
    labelKey: 'Scribe.menu.correct_grammar',
    icon: CheckIcon,
    children: null,
    prompt: 'Correct the grammar and spelling of the following text:\n\n{selectedText}',
    mockResult: 'capitalize'
  },
  {
    id: 'translate',
    labelKey: 'Scribe.menu.translate',
    icon: GlobeIcon,
    sortStrategy: 'by-language-frequency',
    prompt: null,
    mockResult: null,
    children: [
      {
        id: 'translate-en',
        label: 'English',
        labelKey: null,
        icon: null,
        prompt: 'Translate the following text to English:\n\n{selectedText}',
        mockResult: 'wrap:[EN] Translation::[/EN]'
      },
      {
        id: 'translate-fr',
        label: 'Français',
        labelKey: null,
        icon: null,
        prompt: 'Translate the following text to Français:\n\n{selectedText}',
        mockResult: 'wrap:[FR] Translation::[/FR]'
      },
      {
        id: 'translate-de',
        label: 'Deutsch',
        labelKey: null,
        icon: null,
        prompt: 'Translate the following text to Deutsch:\n\n{selectedText}',
        mockResult: 'wrap:[DE] Translation::[/DE]'
      },
      {
        id: 'translate-es',
        label: 'Español',
        labelKey: null,
        icon: null,
        prompt: 'Translate the following text to Español:\n\n{selectedText}',
        mockResult: 'wrap:[ES] Translation::[/ES]'
      },
      {
        id: 'translate-it',
        label: 'Italiano',
        labelKey: null,
        icon: null,
        prompt: 'Translate the following text to Italiano:\n\n{selectedText}',
        mockResult: 'wrap:[IT] Translation::[/IT]'
      },
      {
        id: 'translate-custom',
        label: '',
        labelKey: null,
        placeholderKey: 'Scribe.translate.other_language',
        icon: null,
        type: 'input',
        prompt: 'Translate the following text to {language}:\n\n{selectedText}',
        mockResult: 'wrap:[{language}] Translation::[/{language}]'
      }
    ]
  },
  {
    id: 'change-tone',
    labelKey: 'Scribe.menu.change_tone',
    icon: PenIcon,
    prompt: null,
    mockResult: null,
    children: [
      {
        id: 'tone-professional',
        labelKey: 'Scribe.tone.professional',
        icon: CompanyIcon,
        prompt: 'Rewrite the following text in a more professional tone:\n\n{selectedText}',
        mockResult: 'wrap:Dear Sir/Madam,:Best regards.'
      },
      {
        id: 'tone-casual',
        labelKey: 'Scribe.tone.casual',
        icon: CocktailIcon,
        prompt: 'Rewrite the following text in a more casual, friendly tone:\n\n{selectedText}',
        mockResult: 'wrap:Hey!:Cheers!'
      },
      {
        id: 'tone-polite',
        labelKey: 'Scribe.tone.polite',
        icon: HandIcon,
        prompt: 'Rewrite the following text in a more polite and courteous tone:\n\n{selectedText}',
        mockResult: 'wrap:If I may,:Thank you kindly.'
      }
    ]
  },
  {
    id: 'improve',
    labelKey: 'Scribe.menu.improve',
    icon: MagicTrickIcon,
    prompt: null,
    mockResult: null,
    children: [
      {
        id: 'improve-shorter',
        labelKey: 'Scribe.improve.shorter',
        icon: ContractIcon,
        prompt: 'Make the following text shorter and more concise while preserving the key meaning:\n\n{selectedText}',
        mockResult: 'truncate-half'
      },
      {
        id: 'improve-expand',
        labelKey: 'Scribe.improve.expand',
        icon: ExpandIcon,
        prompt: 'Expand the following text with additional context, detail and explanation:\n\n{selectedText}',
        mockResult: 'suffix: (expanded with additional context and detail)'
      },
      {
        id: 'improve-emojify',
        labelKey: 'Scribe.improve.emojify',
        icon: 'emoji',
        prompt: 'Add relevant emojis to the following text to make it more expressive:\n\n{selectedText}',
        mockResult: 'emojify'
      },
      {
        id: 'improve-bullets',
        labelKey: 'Scribe.improve.bullets',
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
