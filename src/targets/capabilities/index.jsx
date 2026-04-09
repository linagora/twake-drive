/* eslint-disable import/order */

import 'cozy-ui/transpiled/react/stylesheet.css'
import 'cozy-ui/dist/cozy-ui.utils.min.css'

import 'whatwg-fetch'
import React from 'react'
import { createRoot } from 'react-dom/client'

// ambient styles
import styles from '@/styles/main.styl' // eslint-disable-line no-unused-vars

document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('main')
  createRoot(root).render(<div>capabilities target stub</div>)
})
