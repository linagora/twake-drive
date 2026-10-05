import { getFilePickerConfig } from './config'
import { defaultFilePickerConfig } from './constants'

describe('FilePicker config', () => {
  describe('getFilePickerConfig', () => {
    it('keeps Documents opt-in without changing the historical action defaults', () => {
      expect(getFilePickerConfig(null).documents).toBe(null)
      const config = getFilePickerConfig(null, {
        documents: { accept: ['folder'] }
      })
      expect(config.documents).toEqual({ accept: ['folder'] })
      expect(config.sharingLink).toEqual({ allowFolder: true })
      expect(config.downloadLink).toEqual({ allowFolder: false })
      expect(getFilePickerConfig(null, { documents: null }).documents).toBe(
        null
      )
    })

    it('merges intent data over handshake data while ignoring unrelated keys', () => {
      const config = getFilePickerConfig(
        {
          attributes: {
            data: {
              multiple: false,
              documents: null,
              defaultDirId: 'intent-folder'
            }
          }
        },
        {
          multiple: true,
          documents: {},
          defaultDirId: 'service-folder',
          tabs: ['recents'],
          unknown: true
        }
      )
      expect(config).toEqual(
        expect.objectContaining({
          multiple: false,
          documents: null,
          defaultDirId: 'intent-folder',
          tabs: ['recents']
        })
      )
      expect(config).not.toHaveProperty('unknown')
    })

    it('defaults to Drive alone under restriction without silently replacing explicit tabs', () => {
      expect(
        getFilePickerConfig(null, { restrictToDefaultDir: true }).tabs
      ).toEqual(['drive'])
      expect(
        getFilePickerConfig(null, { restrictToDefaultDir: true, tabs: [] }).tabs
      ).toEqual([])
      expect(getFilePickerConfig(null, { tabs: null }).tabs).toBe(null)
    })

    it('returns the default config when intent has no data', () => {
      expect(getFilePickerConfig(null)).toBe(defaultFilePickerConfig)
      expect(getFilePickerConfig(undefined)).toBe(defaultFilePickerConfig)
      expect(getFilePickerConfig({})).toBe(defaultFilePickerConfig)
      expect(getFilePickerConfig({ attributes: {} })).toBe(
        defaultFilePickerConfig
      )
    })

    it('returns the default config when attributes.data is missing', () => {
      expect(getFilePickerConfig({ attributes: { action: 'PICK' } })).toBe(
        defaultFilePickerConfig
      )
    })

    it('uses the automatic theme by default', () => {
      expect(getFilePickerConfig(null).theme.type).toBe(undefined)
    })

    it.each([undefined, 'light', 'dark'])('preserves the %s theme', theme => {
      const intent = {
        attributes: { data: { theme: { type: theme } } }
      }

      expect(getFilePickerConfig(intent).theme.type).toBe(theme)
    })

    it.each([null, 'sepia'])(
      'falls back to undefined for the %s theme',
      theme => {
        const intent = {
          attributes: { data: { theme: { type: theme } } }
        }

        expect(getFilePickerConfig(intent).theme.type).toBe(undefined)
      }
    )

    it('reads the theme from service data', () => {
      expect(
        getFilePickerConfig(null, { theme: { type: 'dark' } }).theme.type
      ).toBe('dark')
    })

    it('preserves multiple selection by default', () => {
      expect(getFilePickerConfig(null).multiple).toBe(true)
    })

    it('preserves an explicit single selection mode', () => {
      const intent = {
        attributes: { data: { multiple: false } }
      }

      expect(getFilePickerConfig(intent).multiple).toBe(false)
    })

    it('reads multiple selection mode from service data', () => {
      expect(getFilePickerConfig(null, { multiple: false }).multiple).toBe(
        false
      )
    })

    it('merges a client action config over the default', () => {
      const intent = {
        attributes: {
          data: {
            sharingLink: { label: 'As link' },
            downloadLink: { label: 'As attachment' }
          }
        }
      }
      const config = getFilePickerConfig(intent)

      expect(config.sharingLink).toEqual({
        allowFolder: true,
        label: 'As link'
      })
      expect(config.downloadLink).toEqual({
        allowFolder: false,
        label: 'As attachment'
      })
    })

    it('carries maxFileCount and availableSize into the action config', () => {
      const intent = {
        attributes: {
          data: {
            sharingLink: { maxFileCount: 3, availableSize: 52_428_800 }
          }
        }
      }
      const config = getFilePickerConfig(intent)

      expect(config.sharingLink.maxFileCount).toBe(3)
      expect(config.sharingLink.availableSize).toBe(52_428_800)
    })

    it('preserves an explicit null action (action not offered)', () => {
      const intent = {
        attributes: { data: { downloadLink: null } }
      }
      const config = getFilePickerConfig(intent)

      expect(config.sharingLink).toBe(defaultFilePickerConfig.sharingLink)
      expect(config.downloadLink).toBeNull()
    })

    it('falls back to defaults for actions the client did not mention', () => {
      const intent = {
        attributes: { data: { sharingLink: { label: 'As link' } } }
      }
      const config = getFilePickerConfig(intent)

      expect(config.sharingLink.label).toBe('As link')
      expect(config.downloadLink).toBe(defaultFilePickerConfig.downloadLink)
    })

    it('does not leak cozy-interapp transport keys into the config', () => {
      const intent = {
        attributes: {
          data: {
            closeable: false,
            exposeIntentFrameRemoval: true,
            sharingLink: { label: 'As link' }
          }
        }
      }
      const config = getFilePickerConfig(intent)

      expect(config).not.toHaveProperty('closeable')
      expect(config).not.toHaveProperty('exposeIntentFrameRemoval')
      expect(config.sharingLink).toEqual({
        allowFolder: true,
        label: 'As link'
      })
    })
  })
})
