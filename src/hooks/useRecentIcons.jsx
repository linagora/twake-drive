import { useState, useEffect } from 'react'

import logger from '@/lib/logger'

const STORAGE_KEY = 'iconPicker_recent_icons'
const MAX_RECENT_ICONS = 8

/**
 * Hook to get recent icons from localStorage
 * @returns {string[]} recentIcons - List of recently used icon names
 */
export const useRecentIcons = () => {
  const [recentIcons, setRecentIcons] = useState(null)

  useEffect(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY))
      setRecentIcons(Array.isArray(parsed) ? parsed : [])
    } catch (error) {
      logger.error('Failed to load recent icons from localStorage:', error)
      setRecentIcons([])
    }
  }, [])

  return recentIcons
}

/**
 * Add an icon to the recent icons list (for use outside of React components)
 * This function directly updates localStorage and can be called from anywhere
 * @param {string} iconName - Name of the icon to add
 */
export const addRecentIcon = iconName => {
  if (!iconName || iconName === 'none') return

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    let current = []

    if (stored) {
      const parsed = JSON.parse(stored)
      current = Array.isArray(parsed) ? parsed : []
    }

    // Remove icon if it already exists and add it at the beginning
    const filtered = current.filter(icon => icon !== iconName)
    const updated = [iconName, ...filtered].slice(0, MAX_RECENT_ICONS)

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  } catch (error) {
    logger.error('Failed to save recent icons to localStorage:', error)
  }
}
