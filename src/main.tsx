import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/cormorant-garamond/400.css'
import '@fontsource/cormorant-garamond/500.css'
import '@fontsource/cormorant-garamond/400-italic.css'
import '@fontsource/jost/300.css'
import '@fontsource/jost/400.css'
import '@fontsource/jost/500.css'
import './index.css'
import App from './App.tsx'
import BrandReportPage from './screens/BrandReport.tsx'

// Brands open a collab's report at ?report=<token>, without signing in.
const reportToken = new URLSearchParams(window.location.search).get('report')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {reportToken ? <BrandReportPage token={reportToken} /> : <App />}
  </StrictMode>,
)
