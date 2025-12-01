import { SHARED_DRIVES_DIR_ID } from '@/constants/config'
import { getDriveI18n } from '@/locales'

/**
 * Converts a hex color string to an RGB object.
 *
 * @param {string} hex - The hex color string (e.g., "#ff8800" or "ff8800").
 * @returns {{r: number, g: number, b: number}|null} An object with r, g, b values (0-255), or null if input is invalid.
 */
export const hexToRgb = hex => {
  if (!hex) return null
  const normalized = hex.replace(/^#/, '')
  const long = /^(\w{2})(\w{2})(\w{2})$/i
  const match = normalized.match(long)
  if (!match) return null
  const [, r, g, b] = match
  return {
    r: parseInt(r, 16),
    g: parseInt(g, 16),
    b: parseInt(b, 16)
  }
}

/**
 * Converts an RGB object to a hex color string.
 *
 * @param {{r: number, g: number, b: number}} param - The RGB object.
 * @returns {string} The hex color string (e.g., "#ff8800" or "ff8800").
 */
export const rgbToHex = ({ r, g, b }) => {
  const toHex = n => n.toString(16).padStart(2, '0')
  return `#${toHex(Math.max(0, Math.min(255, r)))}${toHex(
    Math.max(0, Math.min(255, g))
  )}${toHex(Math.max(0, Math.min(255, b)))}`
}

/**
 * Mixes two RGB objects with a given factor.
 *
 * @param {{r: number, g: number, b: number}} colorRgb - The color RGB object.
 * @param {{r: number, g: number, b: number}} mixRgb - The mix RGB object.
 * @param {number} factor - The factor (0-1).
 * @returns {{r: number, g: number, b: number}} The mixed RGB object.
 */
export const mixWith = (colorRgb, mixRgb, factor) => {
  // Linear blend: result = color * (1 - f) + mix * f
  const f = Math.max(0, Math.min(1, factor))
  return {
    r: Math.round(colorRgb.r * (1 - f) + mixRgb.r * f),
    g: Math.round(colorRgb.g * (1 - f) + mixRgb.g * f),
    b: Math.round(colorRgb.b * (1 - f) + mixRgb.b * f)
  }
}

/**
 * Generates a shade of a given hex color string.
 *
 * @param {string} baseHex - The base hex color string.
 * @param {{to?: 'white' | 'black', factor?: number}} options - The options.
 * @returns {string} The shaded hex color string.
 */
export const shadeColor = (baseHex, { to = 'white', factor = 0.2 } = {}) => {
  const base = hexToRgb(baseHex)
  if (!base) return baseHex
  const target =
    to === 'black' ? { r: 0, g: 0, b: 0 } : { r: 255, g: 255, b: 255 }
  const mixed = mixWith(base, target, factor)
  return rgbToHex(mixed)
}

export const makeColumns = isBigThumbnail => {
  const { t } = getDriveI18n()

  return [
    {
      id: 'name',
      maxWidth: 0,
      disablePadding: !isBigThumbnail,
      label: t('table.head_name')
    },
    {
      id: 'updated_at',
      disablePadding: false,
      width: 160,
      label: t('table.head_update'),
      textAlign: 'right'
    },
    {
      id: 'size',
      disablePadding: false,
      width: 80,
      label: t('table.head_size'),
      textAlign: 'right'
    },
    {
      id: 'share',
      disablePadding: false,
      width: 125,
      label: t('table.head_status'),
      textAlign: 'right',
      sortable: false
    },
    {
      id: 'menu',
      disablePadding: false,
      width: 60,
      label: '',
      textAlign: 'center',
      sortable: false
    }
  ]
}

/**
 * Sort files by type to put directory and trash before files
 * @param {import('cozy-client/types').IOCozyFile[]} file
 * @returns {import('cozy-client/types').IOCozyFile[]}
 */
export const secondarySort = file => {
  const { tempFolder, folders, files, trashFolder } = file.reduce(
    (acc, el) => {
      if (el?.type === 'tempDirectory') {
        acc.tempFolder.push(el)
      } else if (el?.type === 'directory') {
        if (el?.name === '.cozy_trash') {
          acc.trashFolder.push(el)
        } else if (el?._id === SHARED_DRIVES_DIR_ID) {
          acc.folders.unshift(el)
        } else {
          acc.folders.push(el)
        }
      } else if (el?.type === 'file') {
        acc.files.push(el)
      }
      return acc
    },
    { tempFolder: [], folders: [], files: [], trashFolder: [] }
  )

  return [...tempFolder, ...folders, ...trashFolder, ...files]
}
