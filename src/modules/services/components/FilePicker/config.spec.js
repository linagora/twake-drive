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

    it('keeps reference hidden by default', () => {
      expect(getFilePickerConfig(null).reference).toBeNull()
    })

    it('resolves an explicit reference action', () => {
      const config = getFilePickerConfig({
        attributes: {
          data: { reference: { label: 'Select', onlyFolder: true } }
        }
      })

      expect(config.reference).toEqual({
        label: 'Select',
        onlyFolder: true
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
