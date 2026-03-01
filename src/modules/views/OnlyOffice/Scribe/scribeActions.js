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
 * Declarative action tree that drives the Scribe menu rendering.
 *
 * Each action has:
 * - id: unique identifier used by mockTransform and event handlers
 * - label: display text (English for actions, French for translate targets)
 * - icon: cozy-ui icon component or null
 * - children: array of sub-actions or null for direct actions (no submenu)
 *
 * 4 top-level categories, 11 sub-actions total.
 */
export const SCRIBE_ACTIONS = [
  {
    id: 'correct-grammar',
    label: 'Correct grammar',
    icon: CheckIcon,
    children: null // direct action, no submenu
  },
  {
    id: 'translate',
    label: 'Translate',
    icon: GlobeIcon,
    children: [
      { id: 'translate-francais', label: 'Francais', icon: null },
      { id: 'translate-anglais', label: 'Anglais', icon: null },
      { id: 'translate-russe', label: 'Russe', icon: null },
      { id: 'translate-vietnamien', label: 'Vietnamien', icon: null }
    ]
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
      { id: 'improve-emojify', label: 'Emojify', icon: null },
      { id: 'improve-bullets', label: 'Transform to bullets', icon: ListIcon }
    ]
  }
]
