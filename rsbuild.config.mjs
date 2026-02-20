import { defineConfig, mergeRsbuildConfig } from '@rsbuild/core'
import { getRsbuildConfig } from 'rsbuild-config-cozy-app'

const config = getRsbuildConfig({
  title: 'Twake Drive',
  hasServices: true,
  hasPublic: true,
  hasIntents: true
})

const mergedConfig = mergeRsbuildConfig(config, {
  environments: {
    main: {
      output: {
        copy: [
          {
            from: 'src/assets/onlyOffice',
            to: 'onlyOffice'
          },
          {
            from: 'src/assets/favicons',
            to: 'favicons'
          },
          {
            from: 'vendor/cryptpad-onlyoffice',
            to: 'vendor/cryptpad-onlyoffice'
          }
        ]
      }
    }
  },
  resolve: {
    alias: {
      'react-pdf$': 'react-pdf/dist/esm/entry.webpack'
    }
  }
})

export default defineConfig(mergedConfig)
