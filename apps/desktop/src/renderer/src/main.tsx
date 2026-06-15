import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { MobileInspector } from './features/appium/MobileInspector'
import { TooltipProvider } from './components/ui/tooltip'
import './assets/globals.css'

// A detached inspector window loads the same bundle with #inspector so it can
// run alongside the main IDE window (shared Appium session lives in main process).
const isInspector = window.location.hash === '#inspector'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isInspector ? (
      <TooltipProvider delayDuration={600}>
        <MobileInspector />
      </TooltipProvider>
    ) : (
      <App />
    )}
  </React.StrictMode>,
)
