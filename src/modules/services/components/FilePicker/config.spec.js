import { getFilePickerConfig } from './config'
import { defaultFilePickerConfig } from './constants'

describe('FilePicker config', () => {
  describe('getFilePickerConfig', () => {
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
