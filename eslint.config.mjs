import basics from 'eslint-config-cozy-app/basics'
import cozyReact from 'eslint-config-cozy-app/react'

const baseImportOrderRule = basics.find(c => c.rules?.['import/order'])?.rules[
  'import/order'
]
const baseImportOrderOptions = baseImportOrderRule[1]
const basePathGroups = baseImportOrderOptions.pathGroups

export default [
  ...cozyReact,
  {
    rules: {
      'import/order': [
        'warn',
        {
          ...baseImportOrderOptions,
          pathGroups: [
            ...basePathGroups,
            { pattern: '**/*.styl', group: 'index', position: 'after' },
            { pattern: 'test/**/*', group: 'index' },
            { pattern: 'lib/**/*', group: 'index' },
            { pattern: 'hooks/**/*', group: 'index' },
            { pattern: 'components/**/*', group: 'index' },
            { pattern: 'modules/**/*', group: 'index' },
            { pattern: 'assets/**/*', group: 'index' },
            { pattern: 'models/**/*', group: 'index' },
            { pattern: 'config/**/*', group: 'index' },
            { pattern: 'constants/**/*', group: 'index' },
            { pattern: 'locales/**/*', group: 'index' },
            { pattern: 'queries', group: 'index' }
          ]
        }
      ]
    }
  }
]
