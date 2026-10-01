import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ThemeProvider } from './contexts/ThemeContext';
import { setApiBaseUrl } from '@urbanmind/shared-api'

// Set API base URL from environment variable. In local development, keep requests relative
// so Vite can proxy them to the backend and avoid CORS issues.
const apiUrl = import.meta.env.DEV
  ? ''
  : (import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '')

if (apiUrl) {
  setApiBaseUrl(apiUrl)
} else {
  setApiBaseUrl('')
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
)
