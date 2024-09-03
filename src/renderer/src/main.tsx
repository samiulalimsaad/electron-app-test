import './assets/main.css'

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

import { init } from '@sentry/electron/renderer'

init({
  /* config */
})

// setUser({
//   id: '12345',
//   email: 'user@example.com',
//   username: 'user123'
// })

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
