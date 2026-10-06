/* Main entry point for the application - renders the root React component */
import { createRoot } from 'react-dom/client'
import { instalarBlindagemDOM } from './lib/domGuard'
import App from './App.tsx'
import './main.css'

// Blindagem global contra falhas de 'insertBefore' / 'removeChild' no DOM
instalarBlindagemDOM()

// @skip-protected: Do not remove. Required for React rendering.
createRoot(document.getElementById('root')!).render(<App />)
