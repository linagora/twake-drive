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
          }
        ]
      }
    },
    capabilities: {
      dev: {
        assetPrefix: '/capabilities'
      },
      html: {
        template: './src/targets/capabilities/index.ejs'
      },
      source: {
        entry: {
          capabilities: './src/targets/capabilities/index.jsx'
        }
      },
      output: {
        target: 'web',
        distPath: {
          root: 'build/capabilities'
        },
        assetPrefix: '/capabilities'
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
