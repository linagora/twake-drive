import React, { useRef } from 'react'

import { shadeColor } from './helpers'

let gradientIdCounter = 0

function ColoredFolder({ color = '#1D7AFF', ...props }) {
  const gradientIdRef = useRef(null)
  if (gradientIdRef.current === null) {
    gradientIdRef.current = `file-type-colored-folder-gradient-${++gradientIdCounter}`
  }
  const gradientId = gradientIdRef.current
  const base = color
  const dark = shadeColor(base, { to: 'black', factor: 0.1 })
  const lightStrong = shadeColor(base, { to: 'white', factor: 0.45 })
  const light = shadeColor(base, { to: 'white', factor: 0.35 })
  const mid = shadeColor(base, { to: 'white', factor: 0.15 })
  return (
    <svg viewBox="0 0 16 14" fill="none" {...props}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8 2.125h6.4c.88 0 1.6.731 1.6 1.625v8.125c0 .894-.72 1.625-1.6 1.625H1.6c-.88 0-1.6-.731-1.6-1.625l.008-9.75C.008 1.231.72.5 1.6.5h4.8L8 2.125z"
        fill={`url(#${gradientId})`}
      />
      <defs>
        <linearGradient
          id={gradientId}
          x1={8}
          y1={0.5}
          x2={8}
          y2={16.25}
          gradientUnits="userSpaceOnUse"
        >
          <stop offset={0.044} stopColor={dark} />
          <stop offset={0.13} stopColor={lightStrong} />
          <stop offset={0.617} stopColor={light} />
          <stop offset={1} stopColor={mid} />
        </linearGradient>
      </defs>
    </svg>
  )
}

export default ColoredFolder
